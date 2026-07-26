package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.VenFlowPoVerificationDtos.PoVerificationResponse;
import com.alsorg.packing.domain.venflow.VenFlowAttachmentType;
import com.alsorg.packing.domain.venflow.VenFlowEntry;
import com.alsorg.packing.domain.venflow.VenFlowMaterialAllocation;
import com.alsorg.packing.domain.venflow.VenFlowPoVerification;
import com.alsorg.packing.domain.venflow.VenFlowPoVerificationStatus;
import com.alsorg.packing.repository.VenFlowEntryRepository;
import com.alsorg.packing.repository.VenFlowPoVerificationRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class VenFlowPoVerificationService {

    private final VenFlowPoVerificationRepository verificationRepo;
    private final VenFlowEntryRepository entryRepo;
    private final VenFlowAttachmentService attachmentService;
    private final VenFlowAccessService access;

    public VenFlowPoVerificationService(
            VenFlowPoVerificationRepository verificationRepo,
            VenFlowEntryRepository entryRepo,
            VenFlowAttachmentService attachmentService,
            VenFlowAccessService access) {

        this.verificationRepo = verificationRepo;
        this.entryRepo = entryRepo;
        this.attachmentService = attachmentService;
        this.access = access;
    }

    /**
     * Creates an immutable snapshot of the PO submitted for
     * Director approval.
     */
    public VenFlowPoVerification createPendingSnapshot(
            VenFlowEntry entry,
            VenFlowMaterialAllocation purchaseAllocation,
            UUID poAttachmentId) {

        access.requirePurchase();

        requireEntryAndAllocation(
                entry,
                purchaseAllocation);

        attachmentService.requireActiveAttachment(
                entry.id,
                poAttachmentId,
                VenFlowAttachmentType.PO_DOCUMENT);

        verificationRepo
                .findFirstByEntryIdAndStatusOrderByRevisionDesc(
                        entry.id,
                        VenFlowPoVerificationStatus.PENDING)
                .ifPresent(existing -> {
                    throw conflict(
                            "A pending PO verification already exists "
                                    + "for this requirement.");
                });

        int nextRevision =
                verificationRepo
                        .findMaximumRevision(entry.id)
                        + 1;

        VenFlowPoVerification verification =
                new VenFlowPoVerification();

        verification.entryId =
                entry.id;

        verification.allocationId =
                purchaseAllocation.id;

        verification.revision =
                nextRevision;

        verification.status =
                VenFlowPoVerificationStatus.PENDING;

        verification.plantCode =
                clean(entry.plantCode);

        verification.pdNo =
                clean(entry.pdNo);

        verification.drawingNo =
                clean(entry.drawingNo);

        verification.clientName =
                clean(entry.clientName);

        verification.materialName =
                clean(entry.materialName);

        verification.unit =
                entry.unit;

        verification.purchaseRequestNo =
                clean(
                        purchaseAllocation.purchaseRequestNo);

        verification.plannedQty =
                quantity(
                        purchaseAllocation.plannedQty);

        verification.vendorName =
                requireTextValue(
                        entry.vendorName,
                        "Vendor Name is missing.");

        verification.poNo =
                requireTextValue(
                        entry.poNo,
                        "PO No. is missing.");

        if (entry.poDate == null) {
            throw badRequest(
                    "PO Date is missing.");
        }

        verification.poDate =
                entry.poDate;

        verification.orderedQty =
                positiveQuantity(
                        entry.orderedQty,
                        "Ordered Qty is missing.");

        if (entry.poAmount == null
                || entry.poAmount
                .compareTo(BigDecimal.ZERO) <= 0) {

            throw badRequest(
                    "PO Amount is missing or invalid.");
        }

        verification.poAmount =
                entry.poAmount;

        verification.poAttachmentId =
                poAttachmentId;

        verification.createdBy =
                actor();

        verification.createdAt =
                LocalDateTime.now();

        return verificationRepo.save(
                verification);
    }

    /**
     * Locks and validates the exact pending snapshot selected by
     * the Director.
     */
    public VenFlowPoVerification requirePendingForDecision(
            VenFlowEntry entry,
            VenFlowMaterialAllocation purchaseAllocation,
            UUID verificationId,
            Integer verificationRevision) {

        access.requireDirector();

        requireEntryAndAllocation(
                entry,
                purchaseAllocation);

        if (verificationId == null) {
            throw badRequest(
                    "PO verificationId is required.");
        }

        if (verificationRevision == null
                || verificationRevision < 1) {

            throw badRequest(
                    "PO verificationRevision is required.");
        }

        VenFlowPoVerification verification =
                verificationRepo
                        .findForDecision(
                                entry.id,
                                verificationId,
                                verificationRevision)
                        .orElseThrow(() -> notFound(
                                "PO verification snapshot was not found."));

        if (verification.status
                != VenFlowPoVerificationStatus.PENDING) {

            throw badRequest(
                    "Only a pending PO verification snapshot "
                            + "can be decided.");
        }

        if (!Objects.equals(
                verification.allocationId,
                purchaseAllocation.id)) {

            throw conflict(
                    "The selected PO verification does not belong "
                            + "to the active Purchase allocation.");
        }

        assertSnapshotStillMatches(
                verification,
                entry,
                purchaseAllocation);

        attachmentService.requireActiveAttachment(
                entry.id,
                verification.poAttachmentId,
                VenFlowAttachmentType.PO_DOCUMENT);

        return verification;
    }

    public VenFlowPoVerification markApproved(
            VenFlowPoVerification verification,
            String actor,
            String remarks) {

        access.requireDirector();

        requirePendingVerification(
                verification);

        verification.status =
                VenFlowPoVerificationStatus.APPROVED;

        verification.decidedBy =
                clean(actor);

        verification.decidedAt =
                LocalDateTime.now();

        verification.decisionRemarks =
                clean(remarks);

        return verificationRepo.save(
                verification);
    }

    public VenFlowPoVerification markReturned(
            VenFlowPoVerification verification,
            String actor,
            String remarks) {

        access.requireDirector();

        requirePendingVerification(
                verification);

        if (remarks == null
                || remarks.isBlank()) {

            throw badRequest(
                    "PO return reason is required.");
        }

        verification.status =
                VenFlowPoVerificationStatus.RETURNED;

        verification.decidedBy =
                clean(actor);

        verification.decidedAt =
                LocalDateTime.now();

        verification.decisionRemarks =
                clean(remarks);

        return verificationRepo.save(
                verification);
    }

    @Transactional(readOnly = true)
    public List<PoVerificationResponse> list(
            UUID entryId) {

        access.requirePurchaseOrDirector();

        requireVisibleEntry(
                entryId);

        return verificationRepo
                .findByEntryIdOrderByRevisionDesc(
                        entryId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PoVerificationResponse get(
            UUID entryId,
            UUID verificationId) {

        access.requirePurchaseOrDirector();

        requireVisibleEntry(
                entryId);

        VenFlowPoVerification verification =
                verificationRepo
                        .findByIdAndEntryId(
                                verificationId,
                                entryId)
                        .orElseThrow(() -> notFound(
                                "PO verification snapshot was not found."));

        return toResponse(
                verification);
    }

    private void assertSnapshotStillMatches(
            VenFlowPoVerification verification,
            VenFlowEntry entry,
            VenFlowMaterialAllocation allocation) {

        if (!sameText(
                verification.poNo,
                entry.poNo)) {

            throw conflict(
                    "PO No. changed after the verification "
                            + "snapshot was created.");
        }

        if (!sameText(
                verification.vendorName,
                entry.vendorName)) {

            throw conflict(
                    "Vendor changed after the verification "
                            + "snapshot was created.");
        }

        if (!Objects.equals(
                verification.poDate,
                entry.poDate)) {

            throw conflict(
                    "PO Date changed after the verification "
                            + "snapshot was created.");
        }

        if (!sameAmount(
                verification.orderedQty,
                entry.orderedQty)) {

            throw conflict(
                    "Ordered Qty changed after the verification "
                            + "snapshot was created.");
        }

        if (!sameAmount(
                verification.poAmount,
                entry.poAmount)) {

            throw conflict(
                    "PO Amount changed after the verification "
                            + "snapshot was created.");
        }

        if (!sameAmount(
                verification.plannedQty,
                allocation.plannedQty)) {

            throw conflict(
                    "Purchase requirement quantity changed after "
                            + "the verification snapshot was created.");
        }
    }

    private void requirePendingVerification(
            VenFlowPoVerification verification) {

        if (verification == null) {
            throw badRequest(
                    "PO verification is required.");
        }

        if (verification.status
                != VenFlowPoVerificationStatus.PENDING) {

            throw badRequest(
                    "PO verification has already been decided.");
        }
    }

    private void requireEntryAndAllocation(
            VenFlowEntry entry,
            VenFlowMaterialAllocation allocation) {

        if (entry == null || entry.id == null) {
            throw badRequest(
                    "VenFlow entry is required.");
        }

        if (allocation == null
                || allocation.id == null) {

            throw badRequest(
                    "Purchase allocation is required.");
        }

        if (!Objects.equals(
                entry.id,
                allocation.entryId)) {

            throw badRequest(
                    "Purchase allocation does not belong "
                            + "to the VenFlow entry.");
        }

        access.assertPlantAccess(
                entry.plantCode);
    }

    private VenFlowEntry requireVisibleEntry(
            UUID entryId) {

        if (entryId == null) {
            throw badRequest(
                    "VenFlow Entry ID is required.");
        }

        VenFlowEntry entry = entryRepo
                .findById(entryId)
                .orElseThrow(() -> notFound(
                        "VenFlow entry was not found."));

        access.assertPlantAccess(
                entry.plantCode);

        return entry;
    }

    private PoVerificationResponse toResponse(
            VenFlowPoVerification verification) {

        return new PoVerificationResponse(
                verification.id,
                verification.entryId,
                verification.allocationId,
                verification.revision,
                verification.status,

                verification.plantCode,
                verification.pdNo,
                verification.drawingNo,
                verification.clientName,
                verification.materialName,
                verification.unit,

                verification.purchaseRequestNo,
                verification.plannedQty,

                verification.vendorName,
                verification.poNo,
                verification.poDate,
                verification.orderedQty,
                verification.poAmount,
                verification.poAttachmentId,

                verification.createdBy,
                verification.createdAt,

                verification.decidedBy,
                verification.decidedAt,
                verification.decisionRemarks,

                verification.rowVersion);
    }

    private BigDecimal quantity(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO.setScale(3)
                : value;
    }

    private BigDecimal positiveQuantity(
            BigDecimal value,
            String message) {

        if (value == null
                || value.compareTo(
                BigDecimal.ZERO) <= 0) {

            throw badRequest(
                    message);
        }

        return value;
    }

    private String requireTextValue(
            String value,
            String message) {

        if (value == null
                || value.isBlank()) {

            throw badRequest(
                    message);
        }

        return value.trim();
    }

    private boolean sameText(
            String first,
            String second) {

        return Objects.equals(
                normalize(first),
                normalize(second));
    }

    private String normalize(
            String value) {

        return value == null
                ? null
                : value.trim();
    }

    private boolean sameAmount(
            BigDecimal first,
            BigDecimal second) {

        if (first == null || second == null) {
            return first == null
                    && second == null;
        }

        return first.compareTo(second) == 0;
    }

    private String actor() {
        return access.currentUser()
                .getUsername();
    }

    private String clean(
            String value) {

        return value == null
                ? null
                : value.trim();
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private ResponseStatusException notFound(
            String message) {

        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }

    private ResponseStatusException conflict(
            String message) {

        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message);
    }
}