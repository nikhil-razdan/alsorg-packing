package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.ApproveBomRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.ReturnBomRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.RevisionDetailResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.SubmitBomRequest;

import com.alsorg.packing.domain.bomflow.BomFlowBom;
import com.alsorg.packing.domain.bomflow.BomFlowItem;
import com.alsorg.packing.domain.bomflow.BomFlowRevision;
import com.alsorg.packing.domain.bomflow.BomFlowStatus;

import com.alsorg.packing.repository.bomflow.BomFlowBomRepository;
import com.alsorg.packing.repository.bomflow.BomFlowItemRepository;
import com.alsorg.packing.repository.bomflow.BomFlowRevisionRepository;

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
public class BomFlowApprovalService {

    private final BomFlowBomRepository bomRepo;
    private final BomFlowRevisionRepository revisionRepo;
    private final BomFlowItemRepository itemRepo;

    private final BomFlowAccessService access;
    private final BomFlowAuditService auditService;
    private final BomFlowMapper mapper;

    public BomFlowApprovalService(
            BomFlowBomRepository bomRepo,
            BomFlowRevisionRepository revisionRepo,
            BomFlowItemRepository itemRepo,
            BomFlowAccessService access,
            BomFlowAuditService auditService,
            BomFlowMapper mapper) {

        this.bomRepo = bomRepo;
        this.revisionRepo = revisionRepo;
        this.itemRepo = itemRepo;
        this.access = access;
        this.auditService = auditService;
        this.mapper = mapper;
    }

    /*
     * =========================================================
     * SUBMIT
     * =========================================================
     */

    public RevisionDetailResponse submit(
            UUID revisionId,
            SubmitBomRequest req) {

        access.requireEditor();

        require(
                req,
                "BOM submission body is required.");

        require(
                req.revisionRowVersion(),
                "Revision rowVersion is required.");

        LockedContext context = lockedContext(
                revisionId);

        assertVersion(
                context.revision.rowVersion,
                req.revisionRowVersion(),
                "BOM revision");

        boolean allowed = context.revision.status == BomFlowStatus.DRAFT
                || context.revision.status == BomFlowStatus.RETURNED;

        if (!allowed) {
            throw badRequest(
                    "Only a Draft or Returned "
                            + "revision can be submitted.");
        }

        List<BomFlowItem> activeItems = itemRepo
                .findByRevisionIdAndActiveTrueOrderByLineNoAsc(
                        revisionId);

        validateBeforeSubmission(
                activeItems);

        String actor = access.currentUsername();

        LocalDateTime now = LocalDateTime.now();

        context.revision.engineeringRemarks = clean(req.engineeringRemarks());

        context.revision.bomDocumentAttachmentId = req.bomDocumentAttachmentId();

        context.revision.drawingAttachmentId = req.drawingAttachmentId();

        context.revision.sampleAttachmentId = req.sampleAttachmentId();

        context.revision.status = BomFlowStatus.PENDING_ENGINEERING_APPROVAL;

        context.revision.submittedBy = actor;

        context.revision.submittedAt = now;

        context.revision.returnedBy = null;

        context.revision.returnedAt = null;

        context.revision.returnRemarks = null;

        context.revision.updatedBy = actor;

        context.bom.status = BomFlowStatus.PENDING_ENGINEERING_APPROVAL;

        context.bom.updatedBy = actor;

        revisionRepo.save(
                context.revision);

        bomRepo.save(
                context.bom);

        auditService.record(
                context.bom.id,
                context.revision.id,
                null,
                "BOM_SUBMITTED_FOR_APPROVAL",
                "Status="
                        + context.originalStatus,
                "Status="
                        + context.revision.status
                        + ", Items="
                        + activeItems.size(),
                actor);

        return mapper
                .toRevisionDetailResponse(
                        context.bom,
                        context.revision,
                        activeItems);
    }

    /*
     * =========================================================
     * APPROVE
     * =========================================================
     */

    public RevisionDetailResponse approve(
            UUID revisionId,
            ApproveBomRequest req) {

        access.requireApprover();

        require(
                req,
                "BOM approval body is required.");

        require(
                req.revisionRowVersion(),
                "Revision rowVersion is required.");

        LockedContext context = lockedContext(
                revisionId);

        assertVersion(
                context.revision.rowVersion,
                req.revisionRowVersion(),
                "BOM revision");

        if (context.revision.status != BomFlowStatus.PENDING_ENGINEERING_APPROVAL) {

            throw badRequest(
                    "Only a revision pending "
                            + "Engineering approval "
                            + "can be approved.");
        }

        List<BomFlowItem> activeItems = itemRepo
                .findByRevisionIdAndActiveTrueOrderByLineNoAsc(
                        revisionId);

        validateBeforeSubmission(
                activeItems);

        String actor = access.currentUsername();

        LocalDateTime now = LocalDateTime.now();

        context.revision.status = BomFlowStatus.APPROVED;

        context.revision.approvedBy = actor;

        context.revision.approvedAt = now;

        context.revision.returnedBy = null;

        context.revision.returnedAt = null;

        context.revision.returnRemarks = null;

        context.revision.updatedBy = actor;

        if (hasText(req.remarks())) {
            context.revision.engineeringRemarks = appendText(
                    context.revision.engineeringRemarks,
                    "Approval: "
                            + clean(
                                    req.remarks()));
        }

        context.bom.status = BomFlowStatus.APPROVED;

        context.bom.updatedBy = actor;

        revisionRepo.save(
                context.revision);

        bomRepo.save(
                context.bom);

        auditService.record(
                context.bom.id,
                context.revision.id,
                null,
                "BOM_APPROVED",
                "Status="
                        + context.originalStatus,
                "Status=APPROVED, Approved By="
                        + actor,
                actor);

        return mapper
                .toRevisionDetailResponse(
                        context.bom,
                        context.revision,
                        activeItems);
    }

    /*
     * =========================================================
     * RETURN
     * =========================================================
     */

    public RevisionDetailResponse returnForCorrection(
            UUID revisionId,
            ReturnBomRequest req) {

        access.requireReviewer();

        require(
                req,
                "BOM return body is required.");

        require(
                req.revisionRowVersion(),
                "Revision rowVersion is required.");

        requireText(
                req.remarks(),
                "Return remarks are required.");

        LockedContext context = lockedContext(
                revisionId);

        assertVersion(
                context.revision.rowVersion,
                req.revisionRowVersion(),
                "BOM revision");

        if (context.revision.status != BomFlowStatus.PENDING_ENGINEERING_APPROVAL) {

            throw badRequest(
                    "Only a revision pending "
                            + "Engineering approval "
                            + "can be returned.");
        }

        String actor = access.currentUsername();

        LocalDateTime now = LocalDateTime.now();

        context.revision.status = BomFlowStatus.RETURNED;

        context.revision.returnedBy = actor;

        context.revision.returnedAt = now;

        context.revision.returnRemarks = clean(req.remarks());

        context.revision.approvedBy = null;

        context.revision.approvedAt = null;

        context.revision.updatedBy = actor;

        context.bom.status = BomFlowStatus.RETURNED;

        context.bom.updatedBy = actor;

        revisionRepo.save(
                context.revision);

        bomRepo.save(
                context.bom);

        auditService.record(
                context.bom.id,
                context.revision.id,
                null,
                "BOM_RETURNED_FOR_CORRECTION",
                "Status="
                        + context.originalStatus,
                "Status=RETURNED, Reason="
                        + clean(req.remarks()),
                actor);

        List<BomFlowItem> items = itemRepo
                .findByRevisionIdOrderByLineNoAsc(
                        revisionId);

        return mapper
                .toRevisionDetailResponse(
                        context.bom,
                        context.revision,
                        items);
    }

    /*
     * =========================================================
     * VALIDATION
     * =========================================================
     */

    private void validateBeforeSubmission(
            List<BomFlowItem> items) {

        if (items == null
                || items.isEmpty()) {

            throw badRequest(
                    "At least one active material "
                            + "line is required before submission.");
        }

        for (BomFlowItem item : items) {

            if (item.lineNo == null
                    || item.lineNo < 1) {

                throw badRequest(
                        "Every BOM item must have "
                                + "a valid Line No.");
            }

            if (item.category == null) {
                throw badRequest(
                        "Every BOM item must have "
                                + "a Material Category.");
            }

            if (!hasText(item.itemName)) {
                throw badRequest(
                        "Every BOM item must have "
                                + "an Item Name.");
            }

            if (item.baseQty == null
                    || item.baseQty.compareTo(
                            BigDecimal.ZERO) <= 0) {

                throw badRequest(
                        "Every active BOM item must "
                                + "have Base Qty greater "
                                + "than zero.");
            }

            if (item.requiredQty == null
                    || item.requiredQty.compareTo(
                            BigDecimal.ZERO) <= 0) {

                throw badRequest(
                        "Every active BOM item must "
                                + "have Required Qty greater "
                                + "than zero.");
            }

            if (item.unit == null) {
                throw badRequest(
                        "Every BOM item must have "
                                + "a Material Unit.");
            }

            if (item.materialAmount == null
                    || item.materialAmount.compareTo(
                            BigDecimal.ZERO) < 0) {

                throw badRequest(
                        "Every BOM item must have "
                                + "a valid Material Amount.");
            }

            if (item.processingAmount == null
                    || item.processingAmount.compareTo(
                            BigDecimal.ZERO) < 0) {

                throw badRequest(
                        "Every BOM item must have "
                                + "a valid Processing Amount.");
            }

            if (item.totalAmount == null
                    || item.totalAmount.compareTo(
                            BigDecimal.ZERO) < 0) {

                throw badRequest(
                        "Every BOM item must have "
                                + "a valid Total Amount.");
            }
        }
    }

    private LockedContext lockedContext(
            UUID revisionId) {

        if (revisionId == null) {
            throw badRequest(
                    "Revision ID is required.");
        }

        BomFlowRevision initial = revisionRepo
                .findById(revisionId)
                .orElseThrow(() -> notFound(
                        "BOM revision not found."));

        BomFlowBom bom = bomRepo.findByIdForUpdate(
                initial.bomId)
                .orElseThrow(() -> notFound(
                        "BOM not found."));

        access.assertPlantAccess(
                bom.plantCode);

        BomFlowRevision revision = revisionRepo
                .findByIdForUpdate(
                        revisionId)
                .orElseThrow(() -> notFound(
                        "BOM revision not found."));

        if (!Objects.equals(
                revision.bomId,
                bom.id)) {

            throw conflict(
                    "BOM revision ownership changed. "
                            + "Reload and try again.");
        }

        if (!Objects.equals(
                bom.currentRevisionNo,
                revision.revisionNo)) {

            throw badRequest(
                    "Only the current BOM revision "
                            + "can be submitted, approved "
                            + "or returned.");
        }

        return new LockedContext(
                bom,
                revision,
                revision.status);
    }

    private void assertVersion(
            Long actual,
            Long supplied,
            String label) {

        if (!Objects.equals(
                actual,
                supplied)) {

            throw conflict(
                    label
                            + " was updated by another user. "
                            + "Reload before submitting.");
        }
    }

    private String appendText(
            String existing,
            String additional) {

        if (!hasText(existing)) {
            return additional;
        }

        return existing.trim()
                + " | "
                + additional;
    }

    private void require(
            Object value,
            String message) {

        if (value == null) {
            throw badRequest(
                    message);
        }
    }

    private void requireText(
            String value,
            String message) {

        if (!hasText(value)) {
            throw badRequest(
                    message);
        }
    }

    private boolean hasText(
            String value) {

        return value != null
                && !value.trim().isEmpty();
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

    private record LockedContext(
            BomFlowBom bom,
            BomFlowRevision revision,
            BomFlowStatus originalStatus) {
    }
}