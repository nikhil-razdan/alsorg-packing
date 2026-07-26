package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.VenFlowDtos.*;
import com.alsorg.packing.domain.venflow.*;
import com.alsorg.packing.repository.VenFlowAuditLogRepository;
import com.alsorg.packing.repository.VenFlowEntryRepository;
import com.alsorg.packing.repository.VenFlowMaterialAllocationRepository;
import com.alsorg.packing.repository.VenFlowMaterialMovementRepository;
import com.alsorg.packing.repository.VenFlowQcInspectionRepository;
import com.alsorg.packing.repository.VenFlowStageHistoryRepository;
import java.util.Objects;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import org.springframework.data.jpa.domain.Specification;

import org.springframework.http.HttpStatus;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class VenFlowService {

        private final VenFlowEntryRepository entryRepo;
        private final VenFlowAuditLogRepository auditRepo;
        private final VenFlowAccessService access;
        private final VenFlowStageHistoryRepository stageHistoryRepo;
        private final VenFlowNotificationService notificationService;
        private final VenFlowMaterialAllocationRepository allocationRepo;
        private final VenFlowMaterialMovementRepository movementRepo;
        private final VenFlowQcInspectionRepository qcInspectionRepo;
        private final VenFlowAttachmentService attachmentService;
        private final VenFlowPoVerificationService poVerificationService;

        public VenFlowService(
                        VenFlowEntryRepository entryRepo,
                        VenFlowAuditLogRepository auditRepo,
                        VenFlowAccessService access,
                        VenFlowStageHistoryRepository stageHistoryRepo,
                        VenFlowNotificationService notificationService,
                        VenFlowMaterialAllocationRepository allocationRepo,
                        VenFlowMaterialMovementRepository movementRepo,
                        VenFlowQcInspectionRepository qcInspectionRepo,
                        VenFlowAttachmentService attachmentService,
                        VenFlowPoVerificationService poVerificationService) {
                this.entryRepo = entryRepo;
                this.auditRepo = auditRepo;
                this.access = access;
                this.stageHistoryRepo = stageHistoryRepo;
                this.notificationService = notificationService;
                this.allocationRepo = allocationRepo;
                this.movementRepo = movementRepo;
                this.qcInspectionRepo = qcInspectionRepo;
                this.attachmentService = attachmentService;
                this.poVerificationService = poVerificationService;
        }

        /*
         * =========================================================
         * ENGINEERING - CREATE BOM / INDENT
         * =========================================================
         */

        public VenFlowEntry create(
                        CreateRequest req) {
                access.requireEngineering();

                require(
                                req,
                                "Request body is required.");

                requireText(
                                req.plantCode(),
                                "Plant is required.");

                require(
                                req.orderDate(),
                                "Order Date is required.");

                requireText(
                                req.pdNo(),
                                "PD No. is required.");

                requireText(
                                req.drawingNo(),
                                "Drawing No. is required.");

                requireText(
                                req.clientName(),
                                "Client Name is required.");

                requireText(
                                req.materialName(),
                                "Material Name is required.");

                requirePositive(
                                req.requiredQty(),
                                "Required Qty must be greater than zero.");

                require(
                                req.unit(),
                                "Unit is required.");

                String plantCode = cleanUpper(
                                req.plantCode());

                access.assertPlantAccess(
                                plantCode);

                String currentActor = actor();

                VenFlowEntry entry = new VenFlowEntry();

                entry.plantCode = plantCode;
                entry.orderDate = req.orderDate();

                entry.pdNo = clean(req.pdNo());
                entry.drawingNo = clean(req.drawingNo());

                entry.clientName = clean(req.clientName());

                entry.materialName = clean(req.materialName());

                entry.productDescription = clean(req.materialName());

                entry.veneerType = clean(req.veneerType());

                entry.thickness = clean(req.thickness());

                entry.size = clean(req.size());

                entry.requiredQty = quantity(
                                req.requiredQty(),
                                "Required Qty must be greater than zero.");

                entry.orderedQty = null;

                BigDecimal zeroQty = BigDecimal.ZERO.setScale(3);

                entry.receivedQty = zeroQty;
                entry.availableQty = zeroQty;
                entry.reservedQty = zeroQty;
                entry.issuedQty = zeroQty;
                entry.usedQty = zeroQty;
                entry.wastageQty = zeroQty;

                entry.toBeOrderedQty = zeroQty;
                entry.purchaseRequestedQty = zeroQty;

                entry.qcAcceptedQty = zeroQty;
                entry.qcRejectedQty = zeroQty;
                entry.qcHoldQty = zeroQty;

                entry.issueReadyQty = zeroQty;
                entry.processingBalanceQty = zeroQty;

                entry.balanceQty = entry.requiredQty;

                entry.unit = req.unit();

                entry.bomReference = clean(req.bomReference());

                entry.remarks = clean(req.remarks());

                entry.stockDecision = VenFlowStockDecision.PENDING;

                entry.storeStatus = VenFlowStoreStatus.PENDING;

                entry.poStatus = VenFlowPoStatus.NOT_RAISED;

                entry.qcStatus = VenFlowQcStatus.NOT_REQUIRED;

                entry.issueStatus = VenFlowIssueStatus.NOT_READY;

                entry.processingStatus = VenFlowProcessingStatus.NOT_STARTED;

                entry.productionStatus = VenFlowProductionStatus.NOT_STARTED;

                entry.raisedBy = currentActor;

                entry.raisedAt = LocalDateTime.now();

                entry.createdBy = currentActor;

                entry.updatedBy = currentActor;

                return transition(
                                entry,
                                VenFlowStage.INDENT_CREATED,
                                "INDENT_CREATED",
                                "Engineering BOM / Indent created.");
        }

        public VenFlowEntry sendToStore(
                        UUID id) {
                access.requireEngineering();

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage != VenFlowStage.INDENT_CREATED) {
                        throw badRequest(
                                        "Only an Engineering BOM / Indent can be sent to AKG Store.");
                }

                String currentActor = actor();

                entry.sentToStoreBy = currentActor;

                entry.sentToStoreAt = LocalDateTime.now();

                return transition(
                                entry,
                                VenFlowStage.SENT_TO_STORE,
                                "SENT_TO_STORE",
                                "Engineering sent BOM / Indent to AKG Store.");
        }

        public MaterialSummaryResponse submitStoreDecision(
                        UUID id,
                        StoreDecisionRequest req) {
                access.requireStore();

                require(
                                req,
                                "Store decision body is required.");

                VenFlowEntry entry = getVisibleForUpdate(id);

                boolean allowed = entry.stage == VenFlowStage.SENT_TO_STORE
                                || entry.stage == VenFlowStage.STORE_REVIEWED
                                || entry.stage == VenFlowStage.STOCK_AVAILABLE;

                if (!allowed) {
                        throw badRequest(
                                        "Store Review & Action is allowed only after Engineering sends the requirement to Store.");
                }

                if (req.rowVersion() == null) {
                        throw badRequest(
                                        "Entry rowVersion is required.");
                }

                if (!Objects.equals(
                                entry.rowVersion,
                                req.rowVersion())) {
                        throw conflict(
                                        "This requirement was updated by another user. Reload before submitting Store Review.");
                }

                if (allocationRepo
                                .existsByEntryIdAndActiveTrue(id)) {
                        throw conflict(
                                        "Store Review & Action has already been submitted for this requirement.");
                }

                BigDecimal required = quantity(
                                entry.requiredQty,
                                "Required Qty is missing.");

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                /*
                 * HOLD creates no allocation.
                 */
                if (Boolean.TRUE.equals(req.hold())) {
                        requireText(
                                        req.remarks(),
                                        "Hold reason is required.");

                        entry.stockDecision = VenFlowStockDecision.HOLD;

                        entry.storeStatus = VenFlowStoreStatus.HOLD;

                        entry.availableQty = BigDecimal.ZERO.setScale(3);

                        entry.toBeOrderedQty = required;

                        entry.purchaseRequestedQty = BigDecimal.ZERO.setScale(3);

                        entry.storeReviewedBy = currentActor;

                        entry.storeReviewedAt = now;
                        entry.remarks = clean(req.remarks());

                        transition(
                                        entry,
                                        VenFlowStage.STORE_REVIEWED,
                                        "STORE_REQUIREMENT_HELD",
                                        "Store placed the requirement on hold. "
                                                        + entry.remarks);

                        return materialSummary(id);
                }

                BigDecimal available = quantity(
                                req.availableQty(),
                                "Available Qty is required.");

                if (available.compareTo(required) > 0) {
                        throw badRequest(
                                        "Available Qty cannot exceed Required Qty.");
                }

                BigDecimal toBeOrdered = required.subtract(available);

                if (toBeOrdered.signum() > 0) {
                        requireText(
                                        req.purchaseRequestNo(),
                                        "Purchase Request No. is required when To Be Ordered Qty is greater than zero.");

                        require(
                                        req.requisitionDate(),
                                        "Requisition Date is required when To Be Ordered Qty is greater than zero.");
                }

                VenFlowStockDecision decision;

                if (available.compareTo(required) == 0) {
                        decision = VenFlowStockDecision.AVAILABLE;
                } else if (available.signum() == 0) {
                        decision = VenFlowStockDecision.NOT_AVAILABLE;
                } else {
                        decision = VenFlowStockDecision.PARTIALLY_AVAILABLE;
                }

                entry.stockDecision = decision;
                entry.storeStatus = toStoreStatus(decision);

                entry.availableQty = available;
                entry.toBeOrderedQty = toBeOrdered;
                entry.purchaseRequestedQty = toBeOrdered;

                /*
                 * PR quantity is not ordered quantity.
                 */
                entry.orderedQty = null;

                /*
                 * Reservation is no longer active.
                 */
                entry.reservedQty = BigDecimal.ZERO.setScale(3);

                entry.storeReviewedBy = currentActor;

                entry.storeReviewedAt = now;

                entry.purchaseRequestNo = toBeOrdered.signum() > 0
                                ? clean(
                                                req.purchaseRequestNo())
                                : null;

                entry.requisitionSlipNo = entry.purchaseRequestNo;

                entry.requisitionDate = toBeOrdered.signum() > 0
                                ? req.requisitionDate()
                                : null;

                entry.purchaseRequestBy = toBeOrdered.signum() > 0
                                ? currentActor
                                : null;

                entry.purchaseRequestAt = toBeOrdered.signum() > 0
                                ? now
                                : null;

                entry.sentToPurchaseBy = toBeOrdered.signum() > 0
                                ? currentActor
                                : null;

                entry.sentToPurchaseAt = toBeOrdered.signum() > 0
                                ? now
                                : null;

                entry.qcStatus = available.signum() > 0
                                ? VenFlowQcStatus.PENDING
                                : VenFlowQcStatus.NOT_REQUIRED;

                entry.issueStatus = VenFlowIssueStatus.NOT_READY;

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                if (available.signum() > 0) {
                        VenFlowMaterialAllocation storeAllocation = createAllocation(
                                        entry,
                                        VenFlowMaterialSource.STORE_STOCK,
                                        VenFlowAllocationStatus.QC_PENDING,
                                        available,
                                        available,
                                        null,
                                        null);

                        materialMovement(
                                        entry,
                                        storeAllocation,
                                        "STORE_STOCK_SENT_TO_QC",
                                        available,
                                        "Store-available quantity sent directly to QC.",
                                        req.remarks());
                }

                if (toBeOrdered.signum() > 0) {
                        VenFlowMaterialAllocation purchaseAllocation = createAllocation(
                                        entry,
                                        VenFlowMaterialSource.PURCHASE,
                                        VenFlowAllocationStatus.PURCHASE_REQUESTED,
                                        toBeOrdered,
                                        BigDecimal.ZERO.setScale(3),
                                        req.purchaseRequestNo(),
                                        req.requisitionDate());

                        materialMovement(
                                        entry,
                                        purchaseAllocation,
                                        "PURCHASE_REQUEST_CREATED",
                                        toBeOrdered,
                                        "Purchase Request created for shortage quantity.",
                                        req.remarks());
                }

                reconcileEntry(
                                entry,
                                "STORE_REVIEW_AND_ACTION_SUBMITTED",
                                "Required=" + required
                                                + ", Store Available="
                                                + available
                                                + ", To QC="
                                                + available
                                                + ", To Be Ordered="
                                                + toBeOrdered
                                                + ".");

                return materialSummary(id);
        }

        private VenFlowMaterialAllocation createAllocation(
                        VenFlowEntry entry,
                        VenFlowMaterialSource sourceType,
                        VenFlowAllocationStatus status,
                        BigDecimal plannedQty,
                        BigDecimal receivedQty,
                        String purchaseRequestNo,
                        LocalDate requisitionDate) {
                VenFlowMaterialAllocation allocation = new VenFlowMaterialAllocation();

                allocation.entryId = entry.id;
                allocation.sourceType = sourceType;
                allocation.status = status;

                allocation.plannedQty = plannedQty;
                allocation.receivedQty = receivedQty;

                allocation.qcInspectedQty = BigDecimal.ZERO.setScale(3);

                allocation.qcAcceptedQty = BigDecimal.ZERO.setScale(3);

                allocation.qcRejectedQty = BigDecimal.ZERO.setScale(3);

                allocation.qcHoldQty = BigDecimal.ZERO.setScale(3);

                allocation.issuedQty = BigDecimal.ZERO.setScale(3);

                allocation.purchaseRequestNo = clean(purchaseRequestNo);

                allocation.requisitionDate = requisitionDate;

                allocation.active = true;
                allocation.statusEnteredAt = LocalDateTime.now();

                allocation.createdBy = actor();
                allocation.updatedBy = actor();

                return allocationRepo.save(
                                allocation);
        }

        /*
         * =========================================================
         * STORE - STOCK REVIEW
         * =========================================================
         */

        @Deprecated
        public VenFlowEntry storeReview(
                        UUID id,
                        StoreReviewRequest req) {

                access.requireStore();

                throw gone(
                                "Legacy Store Review is disabled. "
                                                + "Use Store Review & Action through /store-decision.");
        }

        @Deprecated
        public VenFlowEntry raisePurchaseRequest(
                        UUID id,
                        PurchaseRequestRequest req) {

                access.requireStore();

                throw gone(
                                "Purchase Request is created automatically through /store-decision.");
        }

        @Deprecated
        public VenFlowEntry updateStoreStatus(
                        UUID id,
                        StoreStatusRequest req) {

                access.requireStore();

                throw gone(
                                "Legacy store-status update is disabled. Use /store-decision.");
        }

        @Deprecated
        public VenFlowEntry sendToPurchase(UUID id) {
                access.requireStore();

                throw gone(
                                "Legacy send-to-purchase is disabled. Use /store-decision.");
        }

        @Deprecated
        public VenFlowEntry updateRequisition(
                        UUID id,
                        RequisitionRequest req) {

                access.requireStore();

                throw gone(
                                "Legacy requisition update is disabled. Use /store-decision.");
        }

        @Deprecated
        public VenFlowEntry updateOrderedQty(
                        UUID id,
                        OrderedQtyRequest req) {

                access.requirePurchase();

                throw gone(
                                "Legacy ordered-quantity update is disabled. "
                                                + "Ordered Qty must be submitted through /po-raise.");
        }

        @Deprecated
        public VenFlowEntry reserveMaterial(
                        UUID id,
                        ReserveMaterialRequest req) {
                access.requireStore();

                throw new ResponseStatusException(
                                HttpStatus.GONE,
                                "Reserve Material has been replaced by Store Review & Action. "
                                                + "Store-available material must move to QC.");
        }

        /*
         * =========================================================
         * PURCHASE - PO
         * =========================================================
         */

        public VenFlowEntry raisePo(
                        UUID id,
                        PoRequest req) {
                access.requirePurchase();

                require(req, "PO body is required.");
                requireText(
                                req.vendorName(),
                                "Vendor Name is required.");
                requireText(
                                req.poNo(),
                                "PO No. is required.");
                require(
                                req.poDate(),
                                "PO Date is required.");

                BigDecimal orderedQty = quantity(
                                req.orderedQty(),
                                "Ordered Qty is required.");

                if (orderedQty.signum() <= 0) {
                        throw badRequest(
                                        "Ordered Qty must be greater than zero.");
                }

                if (req.poAmount() == null
                                || req.poAmount()
                                                .compareTo(BigDecimal.ZERO) <= 0) {
                        throw badRequest(
                                        "PO Amount must be greater than zero.");
                }

                VenFlowEntry entry = getVisibleForUpdate(id);

                require(
                                req.rowVersion(),
                                "Entry rowVersion is required.");

                if (!Objects.equals(
                                entry.rowVersion,
                                req.rowVersion())) {

                        throw conflict(
                                        "The requirement changed while the PO was being prepared. "
                                                        + "Reload before submission.");
                }

                VenFlowMaterialAllocation purchase = allocationRepo
                                .findActiveBySourceForUpdate(
                                                id,
                                                VenFlowMaterialSource.PURCHASE)
                                .orElseThrow(() -> badRequest(
                                                "No active Purchase allocation exists."));

                boolean allowed = purchase.status == VenFlowAllocationStatus.PURCHASE_REQUESTED
                                || purchase.status == VenFlowAllocationStatus.PO_RETURNED;

                if (!allowed) {
                        throw badRequest(
                                        "The Purchase allocation is not ready for PO preparation.");
                }

                if (orderedQty.compareTo(
                                zero(purchase.plannedQty)) != 0) {
                        throw badRequest(
                                        "PO Ordered Qty must equal To Be Ordered Qty: "
                                                        + purchase.plannedQty
                                                        + " "
                                                        + entry.unit
                                                        + ".");
                }

                String currentActor = actor();

                LocalDateTime now = LocalDateTime.now();

                entry.vendorName = clean(req.vendorName());

                entry.poNo = clean(req.poNo());

                entry.poDate = req.poDate();

                entry.orderedQty = orderedQty;

                entry.poAmount = req.poAmount();

                require(
                                req.poAttachmentId(),
                                "PO Document attachment is required.");

                attachmentService.requireActiveAttachment(
                                id,
                                req.poAttachmentId(),
                                VenFlowAttachmentType.PO_DOCUMENT);

                entry.poDocumentUrl = null;
                entry.poStatus = VenFlowPoStatus.PENDING_DIRECTOR_APPROVAL;

                entry.poRaisedBy = currentActor;

                entry.poRaisedAt = now;

                entry.poApprovalRequestedBy = currentActor;

                entry.poApprovalRequestedAt = now;

                entry.directorApprovalRemarks = null;
                entry.directorApprovedBy = null;
                entry.directorApprovedAt = null;
                entry.directorRejectedBy = null;
                entry.directorRejectedAt = null;

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                purchase.status = VenFlowAllocationStatus.PO_PENDING_DIRECTOR_APPROVAL;
                purchase.statusEnteredAt = now;
                purchase.updatedBy = currentActor;

                allocationRepo.save(purchase);

                materialMovement(
                                entry,
                                purchase,
                                "PO_SUBMITTED_FOR_DIRECTOR_APPROVAL",
                                orderedQty,
                                "PO " + entry.poNo
                                                + " submitted for Director approval.",
                                req.remarks());

                VenFlowEntry saved = reconcileEntry(
                                entry,
                                "PO_SUBMITTED_FOR_DIRECTOR_APPROVAL",
                                "PO=" + entry.poNo
                                                + ", Vendor="
                                                + entry.vendorName
                                                + ", Qty="
                                                + orderedQty
                                                + ", Amount="
                                                + entry.poAmount
                                                + ".");

                poVerificationService.createPendingSnapshot(
                                saved,
                                purchase,
                                req.poAttachmentId());

                notificationService
                                .publishPoApprovalRequired(saved);

                return saved;
        }

        @Deprecated
        public VenFlowEntry approvePo(
                        UUID id) {
                access.requireDirector();

                throw gone(
                                "Legacy PO approval is disabled. "
                                                + "Use Director PO approval with the entry rowVersion.");
        }

        public VenFlowEntry directorApprovePo(
                        UUID id,
                        DirectorDecisionRequest req) {

                access.requireDirector();

                require(
                                req,
                                "Director decision body is required.");

                require(
                                req.rowVersion(),
                                "Entry rowVersion is required.");

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (!Objects.equals(
                                entry.rowVersion,
                                req.rowVersion())) {

                        throw conflict(
                                        "This PO was updated by another user. "
                                                        + "Reload before approving.");
                }

                if (entry.poStatus != VenFlowPoStatus.PENDING_DIRECTOR_APPROVAL) {

                        throw badRequest(
                                        "Only a PO pending Director approval can be approved.");
                }

                VenFlowMaterialAllocation purchase = allocationRepo
                                .findActiveBySourceForUpdate(
                                                id,
                                                VenFlowMaterialSource.PURCHASE)
                                .orElseThrow(() -> badRequest(
                                                "No active Purchase allocation exists."));

                if (purchase.status != VenFlowAllocationStatus.PO_PENDING_DIRECTOR_APPROVAL) {

                        throw badRequest(
                                        "Purchase allocation is not pending "
                                                        + "Director approval.");
                }

                /*
                 * Lock and validate the exact PO snapshot selected
                 * by the Director.
                 */
                VenFlowPoVerification verification = poVerificationService
                                .requirePendingForDecision(
                                                entry,
                                                purchase,
                                                req.verificationId(),
                                                req.verificationRevision());

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                entry.poStatus = VenFlowPoStatus.DIRECTOR_APPROVED;

                entry.directorApprovalRemarks = clean(req.remarks());

                entry.directorApprovedBy = currentActor;
                entry.directorApprovedAt = now;

                entry.directorRejectedBy = null;
                entry.directorRejectedAt = null;

                /*
                 * Keep old approval fields synchronized while they exist.
                 */
                entry.poApprovedBy = currentActor;
                entry.poApprovedAt = now;

                purchase.status = VenFlowAllocationStatus.PO_APPROVED;

                purchase.statusEnteredAt = now;
                purchase.updatedBy = currentActor;

                allocationRepo.save(purchase);

                materialMovement(
                                entry,
                                purchase,
                                "PO_APPROVED_BY_DIRECTOR",
                                zero(entry.orderedQty),
                                "Director approved PO " + entry.poNo + ".",
                                req.remarks());

                VenFlowEntry saved = reconcileEntry(
                                entry,
                                "PO_APPROVED_BY_DIRECTOR",
                                "Director approved PO "
                                                + entry.poNo
                                                + ".");

                /*
                 * Mark the same immutable snapshot approved.
                 * This is in the same transaction as the PO decision.
                 */
                poVerificationService.markApproved(
                                verification,
                                currentActor,
                                req.remarks());

                notificationService.publishPoApproved(
                                saved);

                return saved;
        }

        public VenFlowEntry directorRejectPo(
                        UUID id,
                        DirectorDecisionRequest req) {

                access.requireDirector();

                require(
                                req,
                                "Director decision body is required.");

                require(
                                req.rowVersion(),
                                "Entry rowVersion is required.");

                requireText(
                                req.remarks(),
                                "PO return reason is required.");

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (!Objects.equals(
                                entry.rowVersion,
                                req.rowVersion())) {

                        throw conflict(
                                        "This PO was updated by another user. "
                                                        + "Reload before returning it.");
                }

                if (entry.poStatus != VenFlowPoStatus.PENDING_DIRECTOR_APPROVAL) {

                        throw badRequest(
                                        "Only a PO pending Director approval can be returned.");
                }

                VenFlowMaterialAllocation purchase = allocationRepo
                                .findActiveBySourceForUpdate(
                                                id,
                                                VenFlowMaterialSource.PURCHASE)
                                .orElseThrow(() -> badRequest(
                                                "No active Purchase allocation exists."));

                if (purchase.status != VenFlowAllocationStatus.PO_PENDING_DIRECTOR_APPROVAL) {

                        throw badRequest(
                                        "Purchase allocation is not pending "
                                                        + "Director approval.");
                }

                /*
                 * Lock and validate the exact PO snapshot selected
                 * by the Director.
                 */
                VenFlowPoVerification verification = poVerificationService
                                .requirePendingForDecision(
                                                entry,
                                                purchase,
                                                req.verificationId(),
                                                req.verificationRevision());

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                entry.poStatus = VenFlowPoStatus.DIRECTOR_REJECTED;

                entry.directorApprovalRemarks = clean(req.remarks());

                entry.directorRejectedBy = currentActor;
                entry.directorRejectedAt = now;

                entry.directorApprovedBy = null;
                entry.directorApprovedAt = null;

                entry.poApprovedBy = null;
                entry.poApprovedAt = null;

                purchase.status = VenFlowAllocationStatus.PO_RETURNED;

                purchase.statusEnteredAt = now;
                purchase.updatedBy = currentActor;

                allocationRepo.save(purchase);

                materialMovement(
                                entry,
                                purchase,
                                "PO_RETURNED_BY_DIRECTOR",
                                zero(entry.orderedQty),
                                "Director returned PO "
                                                + entry.poNo
                                                + " to Purchase.",
                                req.remarks());

                VenFlowEntry saved = reconcileEntry(
                                entry,
                                "PO_REJECTED_BY_DIRECTOR",
                                "Director returned PO "
                                                + entry.poNo
                                                + ". Reason: "
                                                + clean(req.remarks()));

                poVerificationService.markReturned(
                                verification,
                                currentActor,
                                req.remarks());

                notificationService.publishPoRejected(
                                saved);

                return saved;
        }

        @Transactional(readOnly = true)
        public List<VenFlowStageHistory> stageHistory(
                        UUID id) {
                getVisibleOrThrow(id);

                return stageHistoryRepo
                                .findByEntryIdOrderByEnteredAtAsc(id);
        }

        @Transactional(readOnly = true)
        public DirectorDashboardResponse directorDashboard() {
                access.requireDirector();

                List<VenFlowEntry> all = entryRepo.findAll(visibleSpec());

                LocalDateTime now = LocalDateTime.now();
                LocalDate today = LocalDate.now();

                long totalActiveItems = all.stream()
                                .filter(e -> e.stage != VenFlowStage.READY_FOR_NEXT_STAGE)
                                .count();

                long pendingPoApprovals = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL)
                                .count();

                long approvalSlaBreaches = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL)
                                .filter(e -> minutesInCurrentStage(e, now) > 720)
                                .count();

                long approvedAwaitingVendorOrder = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PO_APPROVED_BY_DIRECTOR)
                                .count();

                long openVendorOrders = all.stream()
                                .filter(e -> e.stage == VenFlowStage.ORDER_PLACED_WITH_VENDOR)
                                .count();

                long vendorDeliveryDelayed = all.stream()
                                .filter(e -> e.stage == VenFlowStage.ORDER_PLACED_WITH_VENDOR)
                                .filter(e -> e.vendorExpectedDate != null
                                                && e.vendorExpectedDate.isBefore(today))
                                .count();

                long storeReceivingPending = all.stream()
                                .filter(e -> e.stage == VenFlowStage.MATERIAL_RECEIVED_AT_STORE
                                                || e.stage == VenFlowStage.GRN_DONE
                                                || e.stage == VenFlowStage.QC_PENDING
                                                || e.stage == VenFlowStage.QC_OK)
                                .count();

                long qcHoldOrReturn = all.stream()
                                .filter(e -> e.stage == VenFlowStage.MATERIAL_REJECTED_HOLD_RETURN
                                                || e.stage == VenFlowStage.QC_NOT_OK)
                                .count();

                long productionInProgress = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PROCESSING_STARTED)
                                .count();

                long supervisorClosurePending = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PROCESS_COMPLETED
                                                || e.stage == VenFlowStage.SUPERVISOR_INFORMED)
                                .count();

                long readyForNextStage = all.stream()
                                .filter(e -> e.stage == VenFlowStage.READY_FOR_NEXT_STAGE)
                                .count();

                BigDecimal pendingApprovalAmount = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL)
                                .map(e -> e.poAmount == null
                                                ? BigDecimal.ZERO
                                                : e.poAmount)
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                double averageApprovalHours = averageApprovalHours(all);
                double averageCycleHours = averageCycleHours(all);

                return new DirectorDashboardResponse(
                                totalActiveItems,
                                pendingPoApprovals,
                                approvalSlaBreaches,
                                approvedAwaitingVendorOrder,
                                openVendorOrders,
                                vendorDeliveryDelayed,
                                storeReceivingPending,
                                qcHoldOrReturn,
                                productionInProgress,
                                supervisorClosurePending,
                                readyForNextStage,
                                pendingApprovalAmount,
                                averageApprovalHours,
                                averageCycleHours);
        }

        public VenFlowEntry placeVendorOrder(
                        UUID id,
                        VendorOrderRequest req) {

                access.requirePurchase();

                require(req, "Vendor order body is required.");

                requireText(
                                req.vendorOrderReference(),
                                "Vendor Order Reference is required.");

                require(
                                req.vendorExpectedDate(),
                                "Vendor Expected Date is required.");

                if (req.vendorExpectedDate().isBefore(LocalDate.now())) {
                        throw badRequest(
                                        "Vendor Expected Date cannot be before today.");
                }

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.poStatus != VenFlowPoStatus.DIRECTOR_APPROVED) {
                        throw badRequest(
                                        "Only a Director-approved PO can be placed with the vendor.");
                }

                VenFlowMaterialAllocation purchase = allocationRepo
                                .findActiveBySourceForUpdate(
                                                id,
                                                VenFlowMaterialSource.PURCHASE)
                                .orElseThrow(() -> badRequest(
                                                "No active Purchase allocation exists."));

                if (purchase.status != VenFlowAllocationStatus.PO_APPROVED) {

                        throw badRequest(
                                        "Purchase allocation is not Director-approved.");
                }

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                entry.poStatus = VenFlowPoStatus.ORDER_PLACED;

                entry.vendorOrderReference = clean(req.vendorOrderReference());

                entry.vendorAcknowledgementNo = clean(req.vendorAcknowledgementNo());

                entry.vendorExpectedDate = req.vendorExpectedDate();

                entry.vendorOrderRemarks = clean(req.remarks());

                entry.vendorOrderPlacedBy = currentActor;
                entry.vendorOrderPlacedAt = now;

                purchase.status = VenFlowAllocationStatus.ORDER_PLACED;
                purchase.statusEnteredAt = now;
                purchase.updatedBy = currentActor;

                allocationRepo.save(purchase);

                materialMovement(
                                entry,
                                purchase,
                                "ORDER_PLACED_WITH_VENDOR",
                                zero(purchase.plannedQty),
                                "Approved PO placed with vendor. Reference: "
                                                + entry.vendorOrderReference
                                                + ".",
                                req.remarks());

                VenFlowEntry saved = reconcileEntry(
                                entry,
                                "ORDER_PLACED_WITH_VENDOR",
                                "Purchase placed approved PO "
                                                + entry.poNo
                                                + " with vendor "
                                                + entry.vendorName
                                                + ". Vendor Order Reference: "
                                                + entry.vendorOrderReference
                                                + ".");

                notificationService.publishVendorOrderPlaced(saved);

                return saved;
        }

        /*
         * =========================================================
         * STORE - RECEIVING / GRN / QC / ACCEPTANCE
         * =========================================================
         */

        public VenFlowEntry materialReceived(
                        UUID id,
                        MaterialReceivedRequest req) {

                access.requireStore();

                require(req, "Request body is required.");

                requirePositive(
                                req.receivedQty(),
                                "Received Qty must be greater than zero.");

                require(
                                req.actualInHouseDate(),
                                "Actual In-House Date is required.");

                if (req.actualInHouseDate().isAfter(LocalDate.now())) {
                        throw badRequest(
                                        "Actual In-House Date cannot be in the future.");
                }

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.poStatus != VenFlowPoStatus.ORDER_PLACED) {
                        throw badRequest(
                                        "Director-approved PO must be placed with the vendor before material receiving.");
                }

                VenFlowMaterialAllocation purchase = allocationRepo
                                .findActiveBySourceForUpdate(
                                                id,
                                                VenFlowMaterialSource.PURCHASE)
                                .orElseThrow(() -> badRequest(
                                                "No active Purchase allocation exists."));

                boolean receivable = purchase.status == VenFlowAllocationStatus.ORDER_PLACED
                                || purchase.status == VenFlowAllocationStatus.PARTIALLY_RECEIVED;

                if (!receivable) {
                        throw badRequest(
                                        "This Purchase allocation is not open for material receiving.");
                }

                BigDecimal deliveryQty = quantity(
                                req.receivedQty(),
                                "Delivery Qty is invalid.");

                BigDecimal orderedQty = zero(purchase.plannedQty);

                if (orderedQty.signum() <= 0) {
                        throw badRequest(
                                        "Purchase allocation has no valid ordered quantity.");
                }

                BigDecimal updatedReceived = zero(purchase.receivedQty).add(deliveryQty);

                if (updatedReceived.compareTo(orderedQty) > 0) {
                        throw badRequest(
                                        "Cumulative Received Qty cannot exceed Ordered Qty. "
                                                        + "Ordered="
                                                        + orderedQty
                                                        + ", Already Received="
                                                        + zero(purchase.receivedQty)
                                                        + ", Current Delivery="
                                                        + deliveryQty
                                                        + ".");
                }

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                purchase.receivedQty = updatedReceived;

                purchase.status = updatedReceived.compareTo(orderedQty) < 0
                                ? VenFlowAllocationStatus.PARTIALLY_RECEIVED
                                : VenFlowAllocationStatus.RECEIVED_GRN_PENDING;

                purchase.statusEnteredAt = now;
                purchase.updatedBy = currentActor;

                allocationRepo.save(purchase);

                entry.actualInHouseDate = req.actualInHouseDate();
                entry.materialReceivedBy = currentActor;
                entry.materialReceivedAt = now;

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                materialMovement(
                                entry,
                                purchase,
                                "PURCHASE_DELIVERY_RECEIVED",
                                deliveryQty,
                                "Purchase delivery received. Cumulative received="
                                                + updatedReceived
                                                + " of "
                                                + orderedQty
                                                + ".",
                                req.remarks());

                VenFlowEntry saved = reconcileEntry(
                                entry,
                                "MATERIAL_RECEIVED_AT_STORE",
                                "Store received delivery quantity "
                                                + deliveryQty
                                                + " "
                                                + entry.unit
                                                + ". Cumulative received="
                                                + updatedReceived
                                                + ", vendor outstanding="
                                                + maxZero(orderedQty.subtract(updatedReceived))
                                                + ".");

                notificationService.publishMaterialReceived(saved);

                return saved;
        }

        public VenFlowEntry grnEntry(
                        UUID id,
                        GrnRequest req) {

                access.requireStore();

                require(req, "Request body is required.");

                requireText(
                                req.grnNo(),
                                "GRN No. is required.");

                require(
                                req.grnDate(),
                                "GRN Date is required.");

                if (req.grnDate().isAfter(LocalDate.now())) {
                        throw badRequest(
                                        "GRN Date cannot be in the future.");
                }

                VenFlowEntry entry = getVisibleForUpdate(id);

                VenFlowMaterialAllocation purchase = allocationRepo
                                .findActiveBySourceForUpdate(
                                                id,
                                                VenFlowMaterialSource.PURCHASE)
                                .orElseThrow(() -> badRequest(
                                                "No active Purchase allocation exists."));

                if (purchase.status != VenFlowAllocationStatus.RECEIVED_GRN_PENDING) {

                        throw badRequest(
                                        "Complete material receiving before creating GRN.");
                }

                if (entry.actualInHouseDate != null
                                && req.grnDate().isBefore(entry.actualInHouseDate)) {

                        throw badRequest(
                                        "GRN Date cannot be before Actual In-House Date.");
                }

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                entry.grnNo = clean(req.grnNo());
                entry.grnDate = req.grnDate();
                entry.grnBy = currentActor;
                entry.grnAt = now;

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                purchase.status = VenFlowAllocationStatus.GRN_DONE;
                purchase.statusEnteredAt = now;
                purchase.updatedBy = currentActor;

                allocationRepo.save(purchase);

                materialMovement(
                                entry,
                                purchase,
                                "GRN_COMPLETED",
                                zero(purchase.receivedQty),
                                "GRN " + entry.grnNo
                                                + " completed. Purchase material is ready for QC.",
                                req.remarks());

                return reconcileEntry(
                                entry,
                                "GRN_DONE",
                                "GRN "
                                                + entry.grnNo
                                                + " completed. Purchase allocation moved to QC.");
        }

        @Deprecated
        public VenFlowEntry qualityCheck(
                        UUID id,
                        QcRequest req) {
                access.requireQc();

                throw gone(
                                "Use allocation-level QC through /entries/{entryId}/allocations/{allocationId}/qc.");
        }

        @Deprecated
        public VenFlowEntry acceptInventory(
                        UUID id) {
                access.requireStore();

                throw gone(
                                "QC-accepted quantity is now automatically issue-ready. Separate inventory acceptance is no longer required.");
        }

        @Deprecated
        public VenFlowEntry informProduction(UUID id) {
                access.requireStore();

                VenFlowEntry e = getVisibleForUpdate(id);

                boolean allowed = e.stage == VenFlowStage.MATERIAL_RESERVED
                                || e.stage == VenFlowStage.MATERIAL_ACCEPTED_IN_STORE
                                || e.stage == VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION;

                if (!allowed) {
                        throw badRequest(
                                        "Material must be reserved, accepted, or issued before Production notification.");
                }

                String actor = actor();

                e.materialInformedBy = actor;
                e.materialInformedAt = LocalDateTime.now();
                e.updatedBy = actor;

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "PRODUCTION_NOTIFIED",
                                null,
                                "Production notified by "
                                                + actor
                                                + ". Stage remains "
                                                + saved.stage);

                return saved;
        }

        public VenFlowEntry issueMaterial(
                        UUID id,
                        IssueMaterialRequest req) {

                access.requireStore();

                require(req, "Request body is required.");

                requirePositive(
                                req.issuedQty(),
                                "Issued Qty must be greater than zero.");

                requireText(
                                req.issuedTo(),
                                "Issued To / Responsible Person is required.");

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage == VenFlowStage.READY_FOR_NEXT_STAGE) {
                        throw badRequest(
                                        "A completed VenFlow requirement cannot issue more material.");
                }

                List<VenFlowMaterialAllocation> allocations = allocationRepo.findActiveForUpdate(id);

                if (allocations.isEmpty()) {
                        throw badRequest(
                                        "No active material allocation exists.");
                }

                BigDecimal qcPending = allocations.stream()
                                .map(a -> maxZero(
                                                zero(a.receivedQty)
                                                                .subtract(zero(a.qcInspectedQty))))
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (qcPending.signum() > 0) {
                        throw badRequest(
                                        "All received material must complete QC before material issue.");
                }

                BigDecimal rejected = allocations.stream()
                                .map(a -> zero(a.qcRejectedQty))
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                BigDecimal hold = allocations.stream()
                                .map(a -> zero(a.qcHoldQty))
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (rejected.signum() > 0 || hold.signum() > 0) {
                        throw badRequest(
                                        "QC Rejected or Hold material must be resolved before material issue.");
                }

                BigDecimal requestedIssue = quantity(
                                req.issuedQty(),
                                "Issued Qty is invalid.");

                BigDecimal currentlyIssued = allocations.stream()
                                .map(a -> zero(a.issuedQty))
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                BigDecimal totalReady = allocations.stream()
                                .map(a -> maxZero(
                                                zero(a.qcAcceptedQty)
                                                                .subtract(zero(a.issuedQty))))
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (requestedIssue.compareTo(totalReady) > 0) {
                        throw badRequest(
                                        "Issued Qty cannot exceed QC-approved issue-ready quantity: "
                                                        + totalReady
                                                        + " "
                                                        + entry.unit
                                                        + ".");
                }

                BigDecimal remainingRequirement = maxZero(
                                zero(entry.requiredQty).subtract(currentlyIssued));

                if (requestedIssue.compareTo(remainingRequirement) > 0) {
                        throw badRequest(
                                        "Issued Qty cannot exceed the remaining project requirement: "
                                                        + remainingRequirement
                                                        + " "
                                                        + entry.unit
                                                        + ".");
                }

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                BigDecimal remainingToIssue = requestedIssue;

                for (VenFlowMaterialAllocation allocation : allocations) {
                        if (remainingToIssue.signum() <= 0) {
                                break;
                        }

                        BigDecimal allocationReady = maxZero(
                                        zero(allocation.qcAcceptedQty)
                                                        .subtract(zero(allocation.issuedQty)));

                        if (allocationReady.signum() <= 0) {
                                continue;
                        }

                        BigDecimal issuedFromAllocation = min(allocationReady, remainingToIssue);

                        allocation.issuedQty = zero(allocation.issuedQty)
                                        .add(issuedFromAllocation);

                        if (allocation.issuedQty.compareTo(
                                        zero(allocation.qcAcceptedQty)) < 0) {

                                allocation.status = VenFlowAllocationStatus.PARTIALLY_ISSUED;
                        } else {
                                allocation.status = VenFlowAllocationStatus.ISSUED;
                        }

                        allocation.statusEnteredAt = now;
                        allocation.updatedBy = currentActor;

                        allocationRepo.save(allocation);

                        materialMovement(
                                        entry,
                                        allocation,
                                        "MATERIAL_ISSUED",
                                        issuedFromAllocation,
                                        "QC-approved material issued to "
                                                        + clean(req.issuedTo())
                                                        + ".",
                                        req.remarks());

                        remainingToIssue = remainingToIssue.subtract(issuedFromAllocation);
                }

                if (remainingToIssue.signum() > 0) {
                        throw conflict(
                                        "Unable to allocate the complete issue quantity. Reload and try again.");
                }

                entry.issuedTo = clean(req.issuedTo());
                entry.issuedBy = currentActor;
                entry.issuedAt = now;

                entry.productionStatus = VenFlowProductionStatus.NOT_STARTED;

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                return reconcileEntry(
                                entry,
                                "MATERIAL_ISSUED_TO_PRODUCTION",
                                "Issued "
                                                + requestedIssue
                                                + " "
                                                + entry.unit
                                                + " to "
                                                + entry.issuedTo
                                                + ".");
        }

        /*
         * =========================================================
         * PROCESSING / PRODUCTION
         * =========================================================
         */

        public VenFlowEntry productionDetails(
                        UUID id,
                        ProductionDetailsRequest req) {
                access.requireProcessing();

                require(req, "Request body is required.");

                requireText(
                                req.productionDetails(),
                                "Processing details are required.");

                requireText(
                                req.supervisorName(),
                                "Responsible Person / Supervisor is required.");

                VenFlowEntry e = getVisibleForUpdate(id);

                boolean allowed = e.stage == VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION
                                || e.stage == VenFlowStage.PROCESSING_STARTED
                                || e.stage == VenFlowStage.PROCESS_COMPLETED;

                if (!allowed) {
                        throw badRequest(
                                        "Processing details can be added only after material is issued.");
                }

                String oldValue = "Details=" + e.productionDetails
                                + ", Responsible Person="
                                + e.supervisorName
                                + ", Stage="
                                + e.stage;

                e.productionDetails = clean(req.productionDetails());

                e.supervisorName = clean(req.supervisorName());

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "PROCESSING_DETAILS_UPDATED",
                                oldValue,
                                "Details="
                                                + saved.productionDetails
                                                + ", Responsible Person="
                                                + saved.supervisorName
                                                + ", Stage remains "
                                                + saved.stage);

                return saved;
        }

        public VenFlowEntry startProcessing(
                        UUID id) {
                access.requireProcessing();

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage != VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION) {
                        throw badRequest(
                                        "Material must be issued to Production before veneer / flitch processing starts.");
                }

                requireText(
                                entry.supervisorName,
                                "Responsible Person / Supervisor must be entered before starting processing.");

                String currentActor = actor();

                entry.processingStatus = VenFlowProcessingStatus.STARTED;

                entry.productionStatus = VenFlowProductionStatus.STARTED;

                entry.processingStartedBy = currentActor;

                entry.processingStartedAt = LocalDateTime.now();

                return transition(
                                entry,
                                VenFlowStage.PROCESSING_STARTED,
                                "PROCESSING_STARTED",
                                "Veneer / flitch processing started by "
                                                + currentActor
                                                + ".");
        }

        public VenFlowEntry completeProcess(
                        UUID id,
                        ProcessingRequest req) {

                access.requireProcessing();

                require(
                                req,
                                "Request body is required.");

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage != VenFlowStage.PROCESSING_STARTED) {
                        throw badRequest(
                                        "Veneer / flitch processing must be started before completion.");
                }

                requireNonNegative(
                                req.usedQty(),
                                "Used Qty is required and cannot be negative.");

                requireNonNegative(
                                req.wastageQty(),
                                "Wastage Qty is required and cannot be negative.");

                require(
                                req.outputAttachmentId(),
                                "Process Output attachment is required for process completion.");

                attachmentService.requireActiveAttachment(
                                id,
                                req.outputAttachmentId(),
                                VenFlowAttachmentType.PROCESS_OUTPUT);

                requireText(
                                entry.supervisorName,
                                "Responsible Person / Supervisor is required before completion.");

                BigDecimal issued = quantity(
                                zero(entry.issuedQty),
                                "Issued Qty is invalid.");

                BigDecimal used = quantity(
                                req.usedQty(),
                                "Used Qty is invalid.");

                BigDecimal wastage = quantity(
                                req.wastageQty(),
                                "Wastage Qty is invalid.");

                BigDecimal calculatedProcessingBalance = issued
                                .subtract(used)
                                .subtract(wastage);

                if (calculatedProcessingBalance.signum() < 0) {
                        throw badRequest(
                                        "Used Qty plus Wastage Qty cannot exceed Issued Qty.");
                }

                if (req.processingBalanceQty() != null
                                && req.processingBalanceQty()
                                                .compareTo(calculatedProcessingBalance) != 0) {

                        throw badRequest(
                                        "Processing Balance Qty must equal "
                                                        + "Issued Qty minus Used Qty minus Wastage Qty.");
                }

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                entry.usedQty = used;
                entry.wastageQty = wastage;

                /*
                 * Do not overwrite entry.balanceQty.
                 */
                entry.processingBalanceQty = calculatedProcessingBalance;

                entry.processOutputAttachmentId = req.outputAttachmentId();

                /*
                 * Old URL storage is no longer used for newly completed processes.
                 */
                entry.outputImageUrl = null;

                entry.processingStatus = VenFlowProcessingStatus.COMPLETED;

                entry.productionStatus = VenFlowProductionStatus.DONE;

                entry.processCompletedBy = currentActor;
                entry.processCompletedAt = now;

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                return transition(
                                entry,
                                VenFlowStage.PROCESS_COMPLETED,
                                "PROCESS_COMPLETED",
                                "Processing completed. Issued="
                                                + issued
                                                + ", used="
                                                + used
                                                + ", wastage="
                                                + wastage
                                                + ", processing balance="
                                                + calculatedProcessingBalance
                                                + ".");
        }

        /*
         * =========================================================
         * SUPERVISOR CLOSURE
         * =========================================================
         */

        public VenFlowEntry supervisorInformed(
                        UUID id) {
                access.requireProcessingOrSupervisor();

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage != VenFlowStage.PROCESS_COMPLETED) {
                        throw badRequest(
                                        "Completion Update must be recorded before informing the Supervisor.");
                }

                requireText(
                                entry.supervisorName,
                                "Responsible Person / Supervisor is required.");

                String currentActor = actor();

                entry.supervisorInformedBy = currentActor;

                entry.supervisorInformedAt = LocalDateTime.now();

                return transition(
                                entry,
                                VenFlowStage.SUPERVISOR_INFORMED,
                                "SUPERVISOR_INFORMED",
                                "Supervisor "
                                                + entry.supervisorName
                                                + " informed by "
                                                + currentActor
                                                + ".");
        }

        public VenFlowEntry readyForNextStage(
                        UUID id) {
                access.requireSupervisor();

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage != VenFlowStage.SUPERVISOR_INFORMED) {
                        throw badRequest(
                                        "Supervisor must be informed before marking Ready for Next Stage.");
                }

                String currentActor = actor();

                entry.processingStatus = VenFlowProcessingStatus.READY_FOR_NEXT_STAGE;

                entry.productionStatus = VenFlowProductionStatus.DONE;

                entry.nextStageReadyBy = currentActor;

                entry.nextStageReadyAt = LocalDateTime.now();

                return transition(
                                entry,
                                VenFlowStage.READY_FOR_NEXT_STAGE,
                                "READY_FOR_NEXT_STAGE",
                                "Supervisor completed final review and marked the requirement ready for the next stage.");
        }

        /*
         * =========================================================
         * LISTS / DESKS
         * =========================================================
         */

        @Transactional(readOnly = true)
        public Page<VenFlowEntry> list(
                        String search,
                        String plantCode,
                        String stage,
                        String storeStatus,
                        String poStatus,
                        String productionStatus,
                        int page,
                        int size) {
                if (hasText(plantCode)) {
                        access.assertPlantAccess(plantCode);
                }

                Specification<VenFlowEntry> spec = visibleSpec()
                                .and(VenFlowSpecifications.search(search))
                                .and(VenFlowSpecifications.plantCode(plantCode))
                                .and(VenFlowSpecifications.stage(stage))
                                .and(VenFlowSpecifications.storeStatus(storeStatus))
                                .and(VenFlowSpecifications.poStatus(poStatus))
                                .and(VenFlowSpecifications.productionStatus(productionStatus));

                Pageable pageable = PageRequest.of(
                                Math.max(page, 0),
                                Math.min(Math.max(size, 1), 100),
                                Sort.by(Sort.Direction.DESC, "createdAt"));

                return entryRepo.findAll(spec, pageable);
        }

        @Transactional(readOnly = true)
        public Page<VenFlowEntry> purchaseDesk(
                        String search,
                        String plantCode,
                        String poStatus,
                        int page,
                        int size) {
                access.requirePurchase();

                if (hasText(plantCode)) {
                        access.assertPlantAccess(plantCode);
                }

                Specification<VenFlowEntry> spec = visibleSpec()
                                .and(VenFlowSpecifications.search(search))
                                .and(VenFlowSpecifications.plantCode(plantCode))
                                .and(VenFlowSpecifications.poStatus(poStatus))
                                .and(VenFlowSpecifications.stagesIn(List.of(
                                                VenFlowStage.PURCHASE_REQUEST_RAISED,
                                                VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL,
                                                VenFlowStage.PO_REJECTED_BY_DIRECTOR,
                                                VenFlowStage.PO_APPROVED_BY_DIRECTOR,
                                                VenFlowStage.ORDER_PLACED_WITH_VENDOR,
                                                VenFlowStage.MATERIAL_RECEIVED_AT_STORE)));

                Pageable pageable = PageRequest.of(
                                Math.max(page, 0),
                                Math.min(Math.max(size, 1), 100),
                                Sort.by(Sort.Direction.DESC, "purchaseRequestAt")
                                                .and(Sort.by(Sort.Direction.DESC, "createdAt")));

                return entryRepo.findAll(spec, pageable);
        }

        @Transactional(readOnly = true)
        public VenFlowEntry get(UUID id) {
                return getVisibleOrThrow(id);
        }

        /*
         * =========================================================
         * DASHBOARD / REPORTS
         * =========================================================
         */

        @Transactional(readOnly = true)
        public DashboardResponse dashboard() {
                List<VenFlowEntry> all = entryRepo.findAll(visibleSpec());
                LocalDate today = LocalDate.now();

                long total = all.size();

                long pendingStoreCheck = all.stream()
                                .filter(e -> e.stage == VenFlowStage.SENT_TO_STORE)
                                .count();

                long pendingRequisition = all.stream()
                                .filter(e -> e.stage == VenFlowStage.STORE_REVIEWED
                                                || e.stage == VenFlowStage.STOCK_AVAILABLE)
                                .filter(e -> !hasText(e.purchaseRequestNo))
                                .count();

                long pendingOrderQty = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PURCHASE_REQUEST_RAISED)
                                .filter(e -> e.orderedQty == null)
                                .count();

                long pendingReceiving = all.stream()
                                .filter(
                                                e -> e.stage == VenFlowStage.ORDER_PLACED_WITH_VENDOR)
                                .filter(
                                                e -> e.poStatus == VenFlowPoStatus.ORDER_PLACED)
                                .count();

                long balancePending = all.stream()
                                .filter(e -> e.balanceQty != null)
                                .filter(e -> e.balanceQty.compareTo(BigDecimal.ZERO) > 0)
                                .count();

                long delayedItems = all.stream()
                                .filter(e -> e.expectedDate != null)
                                .filter(e -> e.expectedDate.isBefore(today))
                                .filter(e -> e.stage != VenFlowStage.READY_FOR_NEXT_STAGE)
                                .count();

                long completedEntries = all.stream()
                                .filter(e -> e.stage == VenFlowStage.READY_FOR_NEXT_STAGE)
                                .count();

                long sentToPurchase = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PURCHASE_REQUEST_RAISED)
                                .count();

                long pendingPoRaise = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PURCHASE_REQUEST_RAISED)
                                .filter(e -> !hasText(e.poNo))
                                .count();

                long pendingPoApproval = all.stream()
                                .filter(
                                                e -> e.stage == VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL)
                                .filter(
                                                e -> e.poStatus == VenFlowPoStatus.PENDING_DIRECTOR_APPROVAL)
                                .count();

                long pendingMaterialReceiving = all.stream()
                                .filter(
                                                e -> e.stage == VenFlowStage.ORDER_PLACED_WITH_VENDOR)
                                .filter(
                                                e -> e.poStatus == VenFlowPoStatus.ORDER_PLACED)
                                .count();

                long approvedNotOrdered = all.stream()
                                .filter(
                                                e -> e.stage == VenFlowStage.PO_APPROVED_BY_DIRECTOR)
                                .count();

                long directorApprovalPending = all.stream()
                                .filter(
                                                e -> e.stage == VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL)
                                .count();

                BigDecimal pendingApprovalValue = all.stream()
                                .filter(
                                                e -> e.stage == VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL)
                                .map(
                                                e -> e.poAmount == null
                                                                ? BigDecimal.ZERO
                                                                : e.poAmount)
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal approvedNotOrderedValue = all.stream()
                                .filter(
                                                e -> e.stage == VenFlowStage.PO_APPROVED_BY_DIRECTOR)
                                .map(
                                                e -> e.poAmount == null
                                                                ? BigDecimal.ZERO
                                                                : e.poAmount)
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                long materialReceivedNotInformed = all.stream()
                                .filter(e -> e.stage == VenFlowStage.MATERIAL_RECEIVED_AT_STORE
                                                || e.stage == VenFlowStage.GRN_DONE
                                                || e.stage == VenFlowStage.QC_PENDING
                                                || e.stage == VenFlowStage.QC_OK
                                                || e.stage == VenFlowStage.MATERIAL_ACCEPTED_IN_STORE)
                                .count();

                long productionNotStarted = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PRODUCTION_INFORMED
                                                || e.stage == VenFlowStage.PRODUCTION_DETAILS_ADDED
                                                || e.stage == VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION)
                                .count();

                long productionStarted = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PROCESSING_STARTED)
                                .count();

                long jobDone = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PROCESS_COMPLETED
                                                || e.stage == VenFlowStage.SUPERVISOR_INFORMED
                                                || e.stage == VenFlowStage.READY_FOR_NEXT_STAGE)
                                .count();

                long totalPendingWorkLoading = all.stream()
                                .filter(e -> e.stage != VenFlowStage.READY_FOR_NEXT_STAGE)
                                .count();

                return new DashboardResponse(
                                total,
                                pendingStoreCheck,
                                pendingRequisition,
                                pendingOrderQty,
                                pendingReceiving,
                                balancePending,
                                delayedItems,
                                completedEntries,
                                sentToPurchase,
                                pendingPoRaise,
                                pendingPoApproval,
                                pendingMaterialReceiving,
                                materialReceivedNotInformed,
                                productionNotStarted,
                                productionStarted,
                                jobDone,
                                totalPendingWorkLoading);
        }

        @Transactional(readOnly = true)
        public ReportSummaryResponse reportSummary() {
                DashboardResponse d = dashboard();

                return new ReportSummaryResponse(
                                d.totalEntries(),
                                d.pendingStoreCheck(),
                                d.sentToPurchase(),
                                d.pendingPoRaise(),
                                d.pendingPoApproval(),
                                d.pendingMaterialReceiving(),
                                d.materialReceivedNotInformed(),
                                d.productionNotStarted(),
                                d.productionStarted(),
                                d.jobDone(),
                                d.delayedItems(),
                                d.totalPendingWorkLoading());
        }

        @Transactional(readOnly = true)
        public List<VenFlowAuditLog> auditLogs(UUID entryId) {
                getVisibleOrThrow(entryId);

                return auditRepo.findByEntryIdOrderByChangedAtDesc(entryId);
        }

        /*
         * =========================================================
         * COMMON / LEGACY COMPATIBILITY
         * =========================================================
         */

        public VenFlowEntry updateRemarks(UUID id, RemarksRequest req) {
                require(req, "Request body is required.");

                VenFlowEntry e = getVisibleForUpdate(id);

                String oldValue = e.remarks;

                e.remarks = clean(req.remarks());
                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "UPDATE_REMARKS", oldValue, saved.remarks);

                return saved;
        }

        public VenFlowEntry updateProductDetails(
                        UUID id,
                        ProductDetailsRequest req) {

                access.requireEngineering();

                require(
                                req,
                                "Request body is required.");

                requireText(
                                req.productDescription(),
                                "Product Description is required.");

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage != VenFlowStage.INDENT_CREATED) {

                        throw badRequest(
                                        "Product details can only be changed "
                                                        + "before the requirement is sent to Store.");
                }

                String oldValue = "Product="
                                + entry.productDescription
                                + ", Material="
                                + entry.materialName
                                + ", Veneer="
                                + entry.veneerType
                                + ", Size="
                                + entry.size;

                entry.productDescription = clean(req.productDescription());

                /*
                 * Do not overwrite materialName.
                 */
                entry.veneerType = clean(req.veneerType());

                entry.size = clean(req.size());

                entry.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(entry);

                audit(
                                id,
                                "UPDATE_PRODUCT_DETAILS",
                                oldValue,
                                "Product="
                                                + saved.productDescription
                                                + ", Material="
                                                + saved.materialName
                                                + ", Veneer="
                                                + saved.veneerType
                                                + ", Size="
                                                + saved.size);

                return saved;
        }

        public VenFlowEntry updateExpectedDate(
                        UUID id,
                        ExpectedDateRequest req) {

                access.requireEngineering();

                require(
                                req,
                                "Request body is required.");

                require(
                                req.expectedDate(),
                                "Expected Date is required.");

                VenFlowEntry entry = getVisibleForUpdate(id);

                if (entry.stage == VenFlowStage.READY_FOR_NEXT_STAGE) {

                        throw badRequest(
                                        "Expected Date cannot be changed "
                                                        + "after the workflow has been completed.");
                }

                if (entry.orderDate != null
                                && req.expectedDate()
                                                .isBefore(entry.orderDate)) {

                        throw badRequest(
                                        "Expected Date cannot be before Order Date.");
                }

                String oldValue = String.valueOf(
                                entry.expectedDate);

                entry.expectedDate = req.expectedDate();

                entry.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(entry);

                audit(
                                id,
                                "UPDATE_EXPECTED_DATE",
                                oldValue,
                                String.valueOf(
                                                saved.expectedDate));

                return saved;
        }

        public VenFlowEntry updateReceivedQty(UUID id, ReceivedQtyRequest req) {
                require(req, "Request body is required.");

                return materialReceived(
                                id,
                                new MaterialReceivedRequest(
                                                req.receivedQty(),
                                                req.actualInHouseDate(),
                                                "Updated from legacy received-qty endpoint."));
        }

        @Transactional(readOnly = true)
        public Page<VenFlowEntry> supervisorDesk(
                        String search,
                        String plantCode,
                        int page,
                        int size) {
                access.requireSupervisor();

                if (hasText(plantCode)) {
                        access.assertPlantAccess(plantCode);
                }

                Specification<VenFlowEntry> spec = visibleSpec()
                                .and(
                                                VenFlowSpecifications
                                                                .search(search))
                                .and(
                                                VenFlowSpecifications
                                                                .plantCode(
                                                                                plantCode))
                                .and(
                                                VenFlowSpecifications
                                                                .stagesIn(
                                                                                List.of(
                                                                                                VenFlowStage.SUPERVISOR_INFORMED,
                                                                                                VenFlowStage.READY_FOR_NEXT_STAGE)));

                Pageable pageable = PageRequest.of(
                                Math.max(page, 0),
                                Math.min(
                                                Math.max(size, 1),
                                                100),
                                Sort.by(
                                                Sort.Direction.DESC,
                                                "supervisorInformedAt")
                                                .and(
                                                                Sort.by(
                                                                                Sort.Direction.DESC,
                                                                                "updatedAt")));

                return entryRepo.findAll(spec, pageable);
        }

        public VenFlowEntry startProduction(UUID id, ProductionActionRequest req) {
                return startProcessing(id);
        }

        @Deprecated
        public VenFlowEntry jobDone(
                        UUID id,
                        ProductionActionRequest req) {
                access.requireProcessing();

                throw gone(
                                "The legacy job-done endpoint is disabled. "
                                                + "Use /process-complete with quantities and a PROCESS_OUTPUT attachment.");
        }

        @Deprecated
        public VenFlowEntry complete(UUID id) {
                access.requireProcessing();

                throw gone(
                                "The legacy complete endpoint has been removed. "
                                                + "Use /process-complete with quantities and a PROCESS_OUTPUT attachment.");
        }

        /*
         * =========================================================
         * VALIDATION / ACCESS HELPERS
         * =========================================================
         */

        private void require(Object value, String message) {
                if (value == null) {
                        throw badRequest(message);
                }
        }

        private void requireText(String value, String message) {
                if (!hasText(value)) {
                        throw badRequest(message);
                }
        }

        private boolean hasText(String value) {
                return value != null && !value.trim().isEmpty();
        }

        private String clean(String value) {
                return value == null ? null : value.trim();
        }

        private String cleanUpper(String value) {
                return value == null ? null : value.trim().toUpperCase();
        }

        private Specification<VenFlowEntry> visibleSpec() {
                access.requireVenFlowAccess();

                Set<String> plants = access.allowedPlantCodes();

                boolean allPlants = access.isDirector()
                                || (access.isVenFlowManager()
                                                && plants.isEmpty());

                return VenFlowSpecifications.visiblePlants(
                                plants,
                                allPlants);
        }

        private VenFlowEntry getVisibleOrThrow(
                        UUID id) {

                access.requireVenFlowAccess();

                VenFlowEntry entry = entryRepo
                                .findById(id)
                                .orElseThrow(() -> notFound(
                                                "VenFlow entry not found."));

                access.assertPlantAccess(
                                entry.plantCode);

                return entry;
        }

        private VenFlowEntry getVisibleForUpdate(
                        UUID id) {

                access.requireVenFlowAccess();

                VenFlowEntry entry = entryRepo
                                .findByIdForUpdate(id)
                                .orElseThrow(() -> notFound(
                                                "VenFlow entry not found."));

                access.assertPlantAccess(
                                entry.plantCode);

                return entry;
        }

        private ResponseStatusException conflict(
                        String message) {
                return new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                message);
        }

        private ResponseStatusException gone(
                        String message) {
                return new ResponseStatusException(
                                HttpStatus.GONE,
                                message);
        }

        /*
         * =========================================================
         * AUDIT / ACTOR / EXCEPTION
         * =========================================================
         */

        private void audit(UUID entryId, String action, Object oldValue, Object newValue) {
                VenFlowAuditLog log = new VenFlowAuditLog();

                log.entryId = entryId;
                log.action = action;
                log.oldValue = oldValue == null ? null : String.valueOf(oldValue);
                log.newValue = newValue == null ? null : String.valueOf(newValue);
                log.changedBy = actor();

                auditRepo.save(log);
        }

        public MaterialSummaryResponse inspectAllocation(
                        UUID entryId,
                        UUID allocationId,
                        QcInspectionRequest req) {

                access.requireQc();

                require(
                                req,
                                "QC inspection body is required.");

                require(
                                req.allocationVersion(),
                                "Allocation rowVersion is required.");

                VenFlowEntry entry = getVisibleForUpdate(entryId);

                VenFlowMaterialAllocation allocation = allocationRepo
                                .findActiveByIdForUpdate(
                                                entryId,
                                                allocationId)
                                .orElseThrow(() -> notFound(
                                                "Active material allocation not found."));

                if (!Objects.equals(
                                allocation.rowVersion,
                                req.allocationVersion())) {

                        throw conflict(
                                        "This material allocation was updated by another user. "
                                                        + "Reload before submitting QC.");
                }

                requirePositive(
                                req.inspectedQty(),
                                "Inspected Qty must be greater than zero.");

                requireNonNegative(
                                req.acceptedQty(),
                                "Accepted Qty is required and cannot be negative.");

                requireNonNegative(
                                req.rejectedQty(),
                                "Rejected Qty is required and cannot be negative.");

                requireNonNegative(
                                req.holdQty(),
                                "Hold Qty is required and cannot be negative.");

                BigDecimal inspected = quantity(
                                req.inspectedQty(),
                                "Inspected Qty is invalid.");

                BigDecimal accepted = quantity(
                                req.acceptedQty(),
                                "Accepted Qty is invalid.");

                BigDecimal rejected = quantity(
                                req.rejectedQty(),
                                "Rejected Qty is invalid.");

                BigDecimal hold = quantity(
                                req.holdQty(),
                                "Hold Qty is invalid.");

                BigDecimal classified = accepted
                                .add(rejected)
                                .add(hold);

                if (classified.compareTo(inspected) != 0) {
                        throw badRequest(
                                        "Accepted Qty + Rejected Qty + Hold Qty "
                                                        + "must equal Inspected Qty.");
                }

                BigDecimal allocationReceived = zero(allocation.receivedQty);

                BigDecimal alreadyInspected = zero(allocation.qcInspectedQty);

                BigDecimal pendingInspection = maxZero(
                                allocationReceived.subtract(
                                                alreadyInspected));

                if (inspected.compareTo(pendingInspection) > 0) {
                        throw badRequest(
                                        "Inspected Qty cannot exceed pending QC quantity: "
                                                        + pendingInspection
                                                        + " "
                                                        + entry.unit
                                                        + ".");
                }

                require(
                                req.thicknessOk(),
                                "Thickness verification is required.");

                require(
                                req.sizeOk(),
                                "Size verification is required.");

                require(
                                req.surfaceConditionOk(),
                                "Surface-condition verification is required.");

                boolean sampleAvailable = attachmentService.existsActiveAttachment(
                                entryId,
                                VenFlowAttachmentType.SAMPLE_IMAGE)
                                || hasText(entry.sampleImageUrl);

                if (sampleAvailable) {
                        require(
                                        req.sampleCompared(),
                                        "Sample comparison is required because a Sample Image is available.");

                        require(
                                        req.grainMatch(),
                                        "Grain Match verification is required.");

                        require(
                                        req.shadeMatch(),
                                        "Shade Match verification is required.");
                }

                boolean checklistFailure = Boolean.FALSE.equals(req.sampleCompared())
                                || Boolean.FALSE.equals(req.grainMatch())
                                || Boolean.FALSE.equals(req.shadeMatch())
                                || Boolean.FALSE.equals(req.thicknessOk())
                                || Boolean.FALSE.equals(req.sizeOk())
                                || Boolean.FALSE.equals(req.surfaceConditionOk());

                boolean quantityFailure = rejected.signum() > 0
                                || hold.signum() > 0;

                if (checklistFailure && !quantityFailure) {
                        throw badRequest(
                                        "A failed QC checklist must classify quantity "
                                                        + "as Rejected or Hold.");
                }

                if (quantityFailure || checklistFailure) {
                        requireText(
                                        req.rejectionReason(),
                                        "Rejection / Hold reason is required for a QC exception.");
                }

                Set<UUID> evidenceAttachmentIds = new LinkedHashSet<>();

                if (req.evidenceAttachmentIds() != null) {
                        for (UUID attachmentId : req.evidenceAttachmentIds()) {

                                if (attachmentId != null) {
                                        evidenceAttachmentIds.add(
                                                        attachmentId);
                                }
                        }
                }

                /*
                 * Verify that every supplied attachment:
                 * 1. Exists.
                 * 2. Is active.
                 * 3. Belongs to this VenFlow entry.
                 * 4. Is specifically a QC_EVIDENCE attachment.
                 */
                for (UUID attachmentId : evidenceAttachmentIds) {

                        attachmentService.requireActiveAttachment(
                                        entryId,
                                        attachmentId,
                                        VenFlowAttachmentType.QC_EVIDENCE);
                }

                if ((quantityFailure || checklistFailure)
                                && evidenceAttachmentIds.isEmpty()) {

                        throw badRequest(
                                        "At least one QC Evidence attachment is required "
                                                        + "for Rejected or Hold material.");
                }

                String currentActor = actor();
                LocalDateTime now = LocalDateTime.now();

                VenFlowQcInspection inspection = new VenFlowQcInspection();

                inspection.entryId = entryId;
                inspection.allocationId = allocationId;

                inspection.inspectedQty = inspected;
                inspection.acceptedQty = accepted;
                inspection.rejectedQty = rejected;
                inspection.holdQty = hold;
                inspection.evidenceAttachmentIds.addAll(
                                evidenceAttachmentIds);

                inspection.sampleAvailable = sampleAvailable;
                inspection.sampleCompared = req.sampleCompared();
                inspection.grainMatch = req.grainMatch();
                inspection.shadeMatch = req.shadeMatch();
                inspection.thicknessOk = req.thicknessOk();
                inspection.sizeOk = req.sizeOk();
                inspection.surfaceConditionOk = req.surfaceConditionOk();

                inspection.qcRemarks = clean(req.qcRemarks());

                inspection.rejectionReason = clean(req.rejectionReason());

                inspection.checkedBy = currentActor;
                inspection.checkedAt = now;

                qcInspectionRepo.save(inspection);

                allocation.qcInspectedQty = alreadyInspected.add(inspected);

                allocation.qcAcceptedQty = zero(allocation.qcAcceptedQty)
                                .add(accepted);

                allocation.qcRejectedQty = zero(allocation.qcRejectedQty)
                                .add(rejected);

                allocation.qcHoldQty = zero(allocation.qcHoldQty)
                                .add(hold);

                BigDecimal remainingAfterInspection = maxZero(
                                allocationReceived.subtract(
                                                allocation.qcInspectedQty));

                /*
                 * Exception status must take priority even when
                 * some quantity is still pending inspection.
                 */
                if (zero(allocation.qcHoldQty).signum() > 0) {

                        allocation.status = VenFlowAllocationStatus.QC_HOLD;

                } else if (zero(allocation.qcRejectedQty).signum() > 0) {

                        allocation.status = VenFlowAllocationStatus.QC_REJECTED;

                } else if (remainingAfterInspection.signum() > 0) {

                        allocation.status = zero(allocation.qcAcceptedQty).signum() > 0
                                        ? VenFlowAllocationStatus.PARTIALLY_QC_ACCEPTED
                                        : VenFlowAllocationStatus.QC_PENDING;

                } else if (zero(allocation.qcAcceptedQty)
                                .compareTo(
                                                zero(allocation.issuedQty)) > 0) {

                        allocation.status = VenFlowAllocationStatus.READY_FOR_ISSUE;

                } else {

                        allocation.status = VenFlowAllocationStatus.QC_ACCEPTED;
                }

                allocation.statusEnteredAt = now;
                allocation.updatedBy = currentActor;

                allocationRepo.save(allocation);

                entry.qcCheckedBy = currentActor;
                entry.qcCheckedAt = now;
                entry.qcRemarks = clean(req.qcRemarks());
                entry.rejectionReason = clean(req.rejectionReason());

                materialMovement(
                                entry,
                                allocation,
                                "QC_INSPECTION_COMPLETED",
                                inspected,
                                "Allocation QC completed. Accepted="
                                                + accepted
                                                + ", Rejected="
                                                + rejected
                                                + ", Hold="
                                                + hold
                                                + ".",
                                req.qcRemarks());

                VenFlowEntry saved = reconcileEntry(
                                entry,
                                "ALLOCATION_QC_COMPLETED",
                                "Allocation "
                                                + allocation.id
                                                + " inspected. Accepted="
                                                + accepted
                                                + ", Rejected="
                                                + rejected
                                                + ", Hold="
                                                + hold
                                                + ".");

                if (quantityFailure || checklistFailure) {
                        notificationService.publishQcFailure(
                                        saved,
                                        rejected,
                                        hold,
                                        req.rejectionReason());
                }

                return materialSummary(entryId);
        }

        private String actor() {
                Authentication auth = SecurityContextHolder
                                .getContext()
                                .getAuthentication();

                if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
                        return "SYSTEM";
                }

                return auth.getName();
        }

        private ResponseStatusException badRequest(String message) {
                return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }

        private ResponseStatusException notFound(String message) {
                return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
        }

        private BigDecimal zero(BigDecimal value) {
                return value == null
                                ? BigDecimal.ZERO
                                : value;
        }

        private BigDecimal maxZero(BigDecimal value) {
                if (value == null
                                || value.compareTo(BigDecimal.ZERO) < 0) {
                        return BigDecimal.ZERO;
                }

                return value;
        }

        private BigDecimal min(
                        BigDecimal first,
                        BigDecimal second) {
                BigDecimal safeFirst = zero(first);

                BigDecimal safeSecond = zero(second);

                return safeFirst.compareTo(
                                safeSecond) <= 0
                                                ? safeFirst
                                                : safeSecond;
        }

        private long minutesInCurrentStage(
                        VenFlowEntry e,
                        LocalDateTime now) {
                LocalDateTime entered = e.stageEnteredAt != null
                                ? e.stageEnteredAt
                                : e.updatedAt != null
                                                ? e.updatedAt
                                                : e.createdAt;

                if (entered == null) {
                        return 0;
                }

                return java.time.Duration
                                .between(entered, now)
                                .toMinutes();
        }

        private double averageApprovalHours(
                        List<VenFlowEntry> entries) {
                return entries.stream()
                                .filter(e -> e.poApprovalRequestedAt != null
                                                && (e.directorApprovedAt != null
                                                                || e.directorRejectedAt != null))
                                .mapToLong(e -> {
                                        LocalDateTime decisionAt = e.directorApprovedAt != null
                                                        ? e.directorApprovedAt
                                                        : e.directorRejectedAt;

                                        return java.time.Duration
                                                        .between(
                                                                        e.poApprovalRequestedAt,
                                                                        decisionAt)
                                                        .toMinutes();
                                })
                                .average()
                                .orElse(0) / 60.0;
        }

        private double averageCycleHours(
                        List<VenFlowEntry> entries) {
                return entries.stream()
                                .filter(e -> e.raisedAt != null
                                                && e.nextStageReadyAt != null)
                                .mapToLong(e -> java.time.Duration
                                                .between(
                                                                e.raisedAt,
                                                                e.nextStageReadyAt)
                                                .toMinutes())
                                .average()
                                .orElse(0) / 60.0;
        }

        private void requireNonNegative(
                        BigDecimal value,
                        String message) {
                require(value, message);

                if (value.compareTo(BigDecimal.ZERO) < 0) {
                        throw badRequest(message);
                }
        }

        @Transactional(readOnly = true)
        public Page<VenFlowEntry> directorPoQueue(
                        String search,
                        String plantCode,
                        int page,
                        int size) {
                access.requireDirector();

                Specification<VenFlowEntry> spec = visibleSpec()
                                .and(
                                                VenFlowSpecifications
                                                                .search(search))
                                .and(
                                                VenFlowSpecifications
                                                                .plantCode(plantCode))
                                .and(
                                                VenFlowSpecifications
                                                                .stagesIn(
                                                                                List.of(
                                                                                                VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL,
                                                                                                VenFlowStage.PO_APPROVED_BY_DIRECTOR,
                                                                                                VenFlowStage.PO_REJECTED_BY_DIRECTOR,
                                                                                                VenFlowStage.ORDER_PLACED_WITH_VENDOR)));

                if (hasText(plantCode)) {
                        access.assertPlantAccess(plantCode);
                }

                Pageable pageable = PageRequest.of(
                                Math.max(page, 0),
                                Math.min(
                                                Math.max(size, 1),
                                                100),
                                Sort.by(
                                                Sort.Direction.ASC,
                                                "stageEnteredAt")
                                                .and(
                                                                Sort.by(
                                                                                Sort.Direction.DESC,
                                                                                "poAmount")));

                return entryRepo.findAll(spec, pageable);
        }

        private void requirePositive(
                        BigDecimal value,
                        String message) {
                require(value, message);

                if (value.compareTo(BigDecimal.ZERO) <= 0) {
                        throw badRequest(message);
                }
        }

        private String departmentFor(VenFlowStage stage) {
                return switch (stage) {
                        case INDENT_CREATED ->
                                "ENGINEERING";

                        case SENT_TO_STORE,
                                        STORE_REVIEWED,
                                        STOCK_AVAILABLE,
                                        MATERIAL_RESERVED ->
                                "AKG_STORE";

                        case PURCHASE_REQUEST_RAISED,
                                        PO_REJECTED_BY_DIRECTOR,
                                        PO_APPROVED_BY_DIRECTOR ->
                                "PURCHASE";

                        case PO_PENDING_DIRECTOR_APPROVAL ->
                                "DIRECTOR";

                        case ORDER_PLACED_WITH_VENDOR ->
                                "VENDOR";

                        case MATERIAL_RECEIVED_AT_STORE,
                                        GRN_DONE,
                                        QC_PENDING,
                                        QC_OK,
                                        QC_NOT_OK,
                                        MATERIAL_ACCEPTED_IN_STORE,
                                        MATERIAL_REJECTED_HOLD_RETURN ->
                                "AKG_STORE";

                        case MATERIAL_ISSUED_TO_PRODUCTION,
                                        PROCESSING_STARTED,
                                        PROCESS_COMPLETED ->
                                "PRODUCTION";

                        case SUPERVISOR_INFORMED,
                                        READY_FOR_NEXT_STAGE ->
                                "SUPERVISOR";

                        default ->
                                "VENFLOW";
                };
        }

        private VenFlowEntry transition(
                        VenFlowEntry entry,
                        VenFlowStage nextStage,
                        String action,
                        String remarks) {
                require(
                                entry,
                                "VenFlow entry is required.");

                require(
                                nextStage,
                                "Next VenFlow stage is required.");

                LocalDateTime now = LocalDateTime.now();

                String changedBy = actor();

                boolean newEntry = entry.id == null;

                VenFlowStage previousStage = newEntry
                                ? null
                                : entry.stage;

                boolean stageChanged = newEntry
                                || previousStage != nextStage;

                /*
                 * A data update that remains within the same stage must not
                 * restart the stage timer.
                 */
                if (!stageChanged) {
                        entry.updatedBy = changedBy;

                        VenFlowEntry saved = entryRepo.save(entry);

                        audit(
                                        saved.id,
                                        action,
                                        previousStage,
                                        nextStage);

                        /*
                         * Same-stage data updates should not produce general
                         * Director activity notifications.
                         *
                         * Important events already have dedicated notifications,
                         * such as:
                         * - PO approval required
                         * - PO approved or returned
                         * - material received
                         * - QC exception
                         */
                        return saved;
                }

                /*
                 * Close the currently active stage-history row.
                 */
                if (!newEntry) {
                        stageHistoryRepo
                                        .findFirstByEntryIdAndExitedAtIsNullOrderByEnteredAtDesc(
                                                        entry.id)
                                        .ifPresent(open -> {
                                                open.exitedAt = now;

                                                LocalDateTime enteredAt = open.enteredAt != null
                                                                ? open.enteredAt
                                                                : now;

                                                open.durationMinutes = Math.max(
                                                                java.time.Duration
                                                                                .between(
                                                                                                enteredAt,
                                                                                                now)
                                                                                .toMinutes(),
                                                                0L);

                                                open.exitAction = action;

                                                stageHistoryRepo.save(
                                                                open);
                                        });
                }

                /*
                 * Enter the next workflow stage.
                 */
                entry.stage = nextStage;

                entry.currentDepartment = departmentFor(nextStage);

                entry.stageEnteredAt = now;

                entry.stageChangedBy = changedBy;

                entry.lastMovementAt = now;

                entry.updatedBy = changedBy;

                VenFlowEntry saved = entryRepo.save(entry);

                /*
                 * Create the new open stage-history row.
                 */
                VenFlowStageHistory history = new VenFlowStageHistory();

                history.entryId = saved.id;

                history.stage = nextStage;

                history.department = saved.currentDepartment;

                history.enteredAt = now;

                history.enteredBy = changedBy;

                history.remarks = clean(remarks);

                stageHistoryRepo.save(
                                history);

                /*
                 * Permanent audit row.
                 */
                audit(
                                saved.id,
                                action,
                                previousStage,
                                nextStage);

                /*
                 * Director/Admin notification.
                 */
                notificationService
                                .publishDirectorActivity(
                                                saved,
                                                action,
                                                previousStage,
                                                nextStage,
                                                remarks,
                                                changedBy);

                return saved;
        }

        private VenFlowStoreStatus toStoreStatus(
                        VenFlowStockDecision decision) {
                if (decision == null) {
                        return VenFlowStoreStatus.PENDING;
                }

                return switch (decision) {
                        case AVAILABLE ->
                                VenFlowStoreStatus.AVAILABLE_IN_STORE;

                        case PARTIALLY_AVAILABLE ->
                                VenFlowStoreStatus.PARTIALLY_AVAILABLE;

                        case NOT_AVAILABLE ->
                                VenFlowStoreStatus.NOT_AVAILABLE;

                        case HOLD ->
                                VenFlowStoreStatus.HOLD;

                        case PENDING ->
                                VenFlowStoreStatus.PENDING;
                };
        }

        private BigDecimal quantity(
                        BigDecimal value,
                        String message) {
                require(value, message);

                if (value.compareTo(BigDecimal.ZERO) < 0) {
                        throw badRequest(message);
                }

                BigDecimal stripped = value.stripTrailingZeros();

                if (stripped.scale() > 3) {
                        throw badRequest(
                                        "Quantity can have a maximum of 3 decimal places.");
                }

                return value.setScale(
                                3,
                                java.math.RoundingMode.UNNECESSARY);
        }

        private void materialMovement(
                        VenFlowEntry entry,
                        VenFlowMaterialAllocation allocation,
                        String movementType,
                        BigDecimal quantity,
                        String description,
                        String remarks) {
                VenFlowMaterialMovement movement = new VenFlowMaterialMovement();

                movement.entryId = entry.id;

                movement.allocationId = allocation == null
                                ? null
                                : allocation.id;

                movement.movementType = movementType;
                movement.quantity = quantity;
                movement.description = clean(description);
                movement.remarks = clean(remarks);
                movement.performedBy = actor();

                movementRepo.save(movement);
        }

        private void refreshMaterialAggregates(
                        VenFlowEntry entry,
                        List<VenFlowMaterialAllocation> allocations) {
                BigDecimal storeAvailable = allocations.stream()
                                .filter(a -> a.sourceType == VenFlowMaterialSource.STORE_STOCK)
                                .map(a -> zero(a.plannedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal toBeOrdered = allocations.stream()
                                .filter(a -> a.sourceType == VenFlowMaterialSource.PURCHASE)
                                .map(a -> zero(a.plannedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal purchaseReceived = allocations.stream()
                                .filter(a -> a.sourceType == VenFlowMaterialSource.PURCHASE)
                                .map(a -> zero(a.receivedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcInspected = allocations.stream()
                                .map(a -> zero(a.qcInspectedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcAccepted = allocations.stream()
                                .map(a -> zero(a.qcAcceptedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcRejected = allocations.stream()
                                .map(a -> zero(a.qcRejectedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcHold = allocations.stream()
                                .map(a -> zero(a.qcHoldQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal presentedToQc = allocations.stream()
                                .map(a -> zero(a.receivedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal issued = allocations.stream()
                                .map(a -> zero(a.issuedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcPending = maxZero(
                                presentedToQc.subtract(qcInspected));

                boolean qcBlocked = qcRejected.signum() > 0
                                || qcHold.signum() > 0;

                BigDecimal issueReady = qcBlocked
                                ? BigDecimal.ZERO.setScale(3)
                                : maxZero(qcAccepted.subtract(issued));

                BigDecimal finalGap = maxZero(
                                zero(entry.requiredQty).subtract(qcAccepted));

                entry.availableQty = storeAvailable;
                entry.toBeOrderedQty = toBeOrdered;
                entry.purchaseRequestedQty = toBeOrdered;
                entry.receivedQty = purchaseReceived;

                entry.qcAcceptedQty = qcAccepted;
                entry.qcRejectedQty = qcRejected;
                entry.qcHoldQty = qcHold;

                entry.issuedQty = issued;
                entry.issueReadyQty = issueReady;

                entry.balanceQty = finalGap;

                entry.processingBalanceQty = maxZero(
                                issued
                                                .subtract(zero(entry.usedQty))
                                                .subtract(zero(entry.wastageQty)));

                if (qcHold.signum() > 0) {
                        entry.qcStatus = VenFlowQcStatus.HOLD;

                } else if (qcRejected.signum() > 0) {
                        entry.qcStatus = VenFlowQcStatus.NOT_OK;

                } else if (qcPending.signum() > 0) {
                        entry.qcStatus = VenFlowQcStatus.PENDING;

                } else if (qcAccepted.compareTo(
                                zero(entry.requiredQty)) >= 0) {

                        entry.qcStatus = VenFlowQcStatus.OK;

                } else if (qcAccepted.signum() > 0) {
                        entry.qcStatus = VenFlowQcStatus.PARTIALLY_ACCEPTED;

                } else {
                        entry.qcStatus = VenFlowQcStatus.NOT_REQUIRED;
                }

                if (issued.signum() == 0
                                && issueReady.signum() == 0) {

                        entry.issueStatus = VenFlowIssueStatus.NOT_READY;

                } else if (issued.signum() == 0) {
                        entry.issueStatus = VenFlowIssueStatus.READY_FOR_ISSUE;

                } else if (issued.compareTo(qcAccepted) < 0) {
                        entry.issueStatus = VenFlowIssueStatus.PARTIALLY_ISSUED;

                } else {
                        entry.issueStatus = VenFlowIssueStatus.ISSUED;
                }

        }

        private VenFlowEntry reconcileEntry(
                        VenFlowEntry entry,
                        String action,
                        String remarks) {
                List<VenFlowMaterialAllocation> allocations = allocationRepo
                                .findByEntryIdAndActiveTrueOrderByCreatedAtAsc(
                                                entry.id);

                refreshMaterialAggregates(
                                entry,
                                allocations);

                VenFlowStage nextStage = determineAggregateStage(
                                entry,
                                allocations);

                return transition(
                                entry,
                                nextStage,
                                action,
                                remarks);
        }

        private VenFlowStage determineAggregateStage(
                        VenFlowEntry entry,
                        List<VenFlowMaterialAllocation> allocations) {
                if (entry.processingStatus == VenFlowProcessingStatus.READY_FOR_NEXT_STAGE) {
                        return VenFlowStage.READY_FOR_NEXT_STAGE;
                }

                VenFlowMaterialAllocation purchase = allocations.stream()
                                .filter(a -> a.sourceType == VenFlowMaterialSource.PURCHASE)
                                .findFirst()
                                .orElse(null);

                /*
                 * Open commercial branch remains the primary blocker.
                 */
                if (purchase != null) {
                        switch (purchase.status) {
                                case PURCHASE_REQUESTED:
                                        return VenFlowStage.PURCHASE_REQUEST_RAISED;

                                case PO_PENDING_DIRECTOR_APPROVAL:
                                        return VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL;

                                case PO_RETURNED:
                                        return VenFlowStage.PO_REJECTED_BY_DIRECTOR;

                                case PO_APPROVED:
                                        return VenFlowStage.PO_APPROVED_BY_DIRECTOR;

                                case ORDER_PLACED:
                                case PARTIALLY_RECEIVED:
                                        return VenFlowStage.ORDER_PLACED_WITH_VENDOR;

                                case RECEIVED_GRN_PENDING:
                                        return VenFlowStage.MATERIAL_RECEIVED_AT_STORE;

                                case GRN_DONE:
                                case QC_PENDING:
                                case PARTIALLY_QC_ACCEPTED:
                                        return VenFlowStage.QC_PENDING;

                                case QC_REJECTED:
                                case QC_HOLD:
                                        return VenFlowStage.MATERIAL_REJECTED_HOLD_RETURN;

                                default:
                                        break;
                        }
                }

                boolean qcPending = allocations.stream()
                                .anyMatch(a -> a.status == VenFlowAllocationStatus.QC_PENDING
                                                || a.status == VenFlowAllocationStatus.GRN_DONE
                                                || a.status == VenFlowAllocationStatus.PARTIALLY_QC_ACCEPTED);

                if (qcPending) {
                        return VenFlowStage.QC_PENDING;
                }

                if (zero(entry.qcRejectedQty).signum() > 0
                                || zero(entry.qcHoldQty).signum() > 0) {
                        return VenFlowStage.MATERIAL_REJECTED_HOLD_RETURN;
                }

                if (entry.nextStageReadyAt != null) {
                        return VenFlowStage.READY_FOR_NEXT_STAGE;
                }

                if (entry.supervisorInformedAt != null
                                && entry.processingStatus == VenFlowProcessingStatus.COMPLETED) {
                        return VenFlowStage.SUPERVISOR_INFORMED;
                }

                if (entry.processingStatus == VenFlowProcessingStatus.COMPLETED) {
                        return VenFlowStage.PROCESS_COMPLETED;
                }

                if (entry.processingStatus == VenFlowProcessingStatus.STARTED) {
                        return VenFlowStage.PROCESSING_STARTED;
                }

                if (zero(entry.issuedQty).signum() > 0) {
                        return VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION;
                }

                if (zero(entry.issueReadyQty).signum() > 0) {
                        return VenFlowStage.QC_OK;
                }

                if (zero(entry.qcAcceptedQty)
                                .compareTo(
                                                zero(entry.requiredQty)) >= 0) {
                        return VenFlowStage.MATERIAL_ACCEPTED_IN_STORE;
                }

                return entry.stage == null
                                ? VenFlowStage.INDENT_CREATED
                                : entry.stage;
        }

        @Transactional(readOnly = true)
        public MaterialSummaryResponse materialSummary(UUID id) {

                VenFlowEntry entry = getVisibleOrThrow(id);

                List<VenFlowMaterialAllocation> allocations = allocationRepo
                                .findByEntryIdAndActiveTrueOrderByCreatedAtAsc(id);

                BigDecimal required = zero(entry.requiredQty);

                /*
                 * Store allocation planned quantity represents the quantity
                 * identified as physically available in Store.
                 */
                BigDecimal storeAvailable = allocations.stream()
                                .filter(allocation -> allocation.sourceType == VenFlowMaterialSource.STORE_STOCK)
                                .map(allocation -> zero(allocation.plannedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                /*
                 * Purchase allocation planned quantity represents the shortage
                 * submitted to Purchase.
                 */
                BigDecimal toBeOrdered = allocations.stream()
                                .filter(allocation -> allocation.sourceType == VenFlowMaterialSource.PURCHASE)
                                .map(allocation -> zero(allocation.plannedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal purchasedReceived = allocations.stream()
                                .filter(allocation -> allocation.sourceType == VenFlowMaterialSource.PURCHASE)
                                .map(allocation -> zero(allocation.receivedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcInspected = allocations.stream()
                                .map(allocation -> zero(allocation.qcInspectedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcAccepted = allocations.stream()
                                .map(allocation -> zero(allocation.qcAcceptedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcRejected = allocations.stream()
                                .map(allocation -> zero(allocation.qcRejectedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcHold = allocations.stream()
                                .map(allocation -> zero(allocation.qcHoldQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                /*
                 * Store stock is inserted into receivedQty when its allocation
                 * is created, so this correctly includes Store and Purchase QC.
                 */
                BigDecimal presentedToQc = allocations.stream()
                                .map(allocation -> zero(allocation.receivedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                BigDecimal qcPending = maxZero(
                                presentedToQc.subtract(qcInspected));

                BigDecimal issued = allocations.stream()
                                .map(allocation -> zero(allocation.issuedQty))
                                .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add);

                /*
                 * Rejected or Hold material blocks further issue until the QC
                 * exception is resolved.
                 */
                boolean qcBlocked = qcRejected.signum() > 0
                                || qcHold.signum() > 0;

                BigDecimal issueReady = qcBlocked
                                ? BigDecimal.ZERO.setScale(3)
                                : maxZero(qcAccepted.subtract(issued));

                /*
                 * orderedQty becomes meaningful after Purchase raises the PO.
                 */
                BigDecimal ordered = zero(entry.orderedQty);

                BigDecimal vendorOutstanding = maxZero(
                                ordered.subtract(purchasedReceived));

                /*
                 * Permanent meaning of finalGap:
                 * Required quantity minus QC-accepted quantity.
                 */
                BigDecimal finalGap = maxZero(
                                required.subtract(qcAccepted));

                /*
                 * Processing balance is separate from requirement balance.
                 */
                BigDecimal processingBalance = maxZero(
                                issued
                                                .subtract(zero(entry.usedQty))
                                                .subtract(zero(entry.wastageQty)));

                int coveragePercent;

                if (required.signum() <= 0) {
                        coveragePercent = 0;
                } else {
                        int calculatedCoverage = storeAvailable
                                        .multiply(BigDecimal.valueOf(100))
                                        .divide(
                                                        required,
                                                        0,
                                                        java.math.RoundingMode.HALF_UP)
                                        .intValue();

                        /*
                         * Prevent bad legacy data from showing more than 100%.
                         */
                        coveragePercent = Math.max(
                                        0,
                                        Math.min(calculatedCoverage, 100));
                }

                List<String> activeDepartments = calculateActiveDepartments(allocations);

                List<MaterialAllocationResponse> allocationDtos = allocations.stream()
                                .map(allocation -> {

                                        BigDecimal allocationReceived = zero(allocation.receivedQty);

                                        BigDecimal allocationInspected = zero(allocation.qcInspectedQty);

                                        BigDecimal allocationAccepted = zero(allocation.qcAcceptedQty);

                                        BigDecimal allocationRejected = zero(allocation.qcRejectedQty);

                                        BigDecimal allocationHold = zero(allocation.qcHoldQty);

                                        BigDecimal allocationIssued = zero(allocation.issuedQty);

                                        BigDecimal allocationPending = maxZero(
                                                        allocationReceived.subtract(
                                                                        allocationInspected));

                                        boolean allocationBlocked = allocationRejected.signum() > 0
                                                        || allocationHold.signum() > 0;

                                        BigDecimal allocationReady = allocationBlocked
                                                        ? BigDecimal.ZERO.setScale(3)
                                                        : maxZero(
                                                                        allocationAccepted.subtract(
                                                                                        allocationIssued));

                                        return new MaterialAllocationResponse(
                                                        allocation.id,
                                                        allocation.sourceType,
                                                        allocation.status,
                                                        zero(allocation.plannedQty),
                                                        allocationReceived,
                                                        allocationInspected,
                                                        allocationAccepted,
                                                        allocationRejected,
                                                        allocationHold,
                                                        allocationPending,
                                                        allocationIssued,
                                                        allocationReady,
                                                        allocation.purchaseRequestNo,
                                                        allocation.requisitionDate,
                                                        allocation.rowVersion);
                                })
                                .toList();

                return new MaterialSummaryResponse(
                                entry.id,

                                required,
                                storeAvailable,
                                toBeOrdered,

                                ordered,
                                purchasedReceived,
                                vendorOutstanding,

                                qcPending,
                                qcAccepted,
                                qcRejected,
                                qcHold,

                                issued,
                                issueReady,

                                finalGap,

                                zero(entry.usedQty),
                                zero(entry.wastageQty),
                                processingBalance,

                                coveragePercent,
                                activeDepartments,
                                allocationDtos);
        }

        private List<String> calculateActiveDepartments(
                        List<VenFlowMaterialAllocation> allocations) {
                Set<String> departments = new LinkedHashSet<>();

                for (VenFlowMaterialAllocation allocation : allocations) {
                        switch (allocation.status) {
                                case PURCHASE_REQUESTED,
                                                PO_RETURNED,
                                                PO_APPROVED ->
                                        departments.add("PURCHASE");

                                case PO_PENDING_DIRECTOR_APPROVAL ->
                                        departments.add("DIRECTOR");

                                case ORDER_PLACED ->
                                        departments.add("PURCHASE / VENDOR");

                                case PARTIALLY_RECEIVED,
                                                RECEIVED_GRN_PENDING,
                                                GRN_DONE ->
                                        departments.add("STORE");

                                case QC_PENDING,
                                                PARTIALLY_QC_ACCEPTED,
                                                QC_HOLD,
                                                QC_REJECTED ->
                                        departments.add("QC");

                                case READY_FOR_ISSUE,
                                                PARTIALLY_ISSUED ->
                                        departments.add("STORE / PRODUCTION");

                                case ISSUED ->
                                        departments.add("PRODUCTION");

                                default -> {
                                }
                        }
                }

                return List.copyOf(departments);
        }

        @Transactional(readOnly = true)
        public List<MaterialMovementResponse> materialHistory(
                        UUID id) {
                getVisibleOrThrow(id);

                return movementRepo
                                .findByEntryIdOrderByCreatedAtDesc(
                                                id)
                                .stream()
                                .map(movement -> new MaterialMovementResponse(
                                                movement.id,
                                                movement.entryId,
                                                movement.allocationId,
                                                movement.movementType,
                                                movement.quantity,
                                                movement.referenceNo,
                                                movement.description,
                                                movement.remarks,
                                                movement.performedBy,
                                                movement.createdAt))
                                .toList();
        }
}