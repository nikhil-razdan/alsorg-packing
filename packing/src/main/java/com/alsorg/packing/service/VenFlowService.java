package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.VenFlowDtos.*;
import com.alsorg.packing.domain.venflow.*;
import com.alsorg.packing.repository.VenFlowAuditLogRepository;
import com.alsorg.packing.repository.VenFlowEntryRepository;
import com.alsorg.packing.repository.VenFlowStageHistoryRepository;
import com.alsorg.packing.service.VenFlowNotificationService;

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

        public VenFlowService(
                        VenFlowEntryRepository entryRepo,
                        VenFlowAuditLogRepository auditRepo,
                        VenFlowAccessService access,
                        VenFlowStageHistoryRepository stageHistoryRepo,
                        VenFlowNotificationService notificationService) {
                this.entryRepo = entryRepo;
                this.auditRepo = auditRepo;
                this.access = access;
                this.stageHistoryRepo = stageHistoryRepo;
                this.notificationService = notificationService;
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

                requireText(
                                req.sampleImageUrl(),
                                "Sample Image is required.");

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

                entry.requiredQty = req.requiredQty();

                entry.orderedQty = null;

                entry.receivedQty = BigDecimal.ZERO;

                entry.availableQty = BigDecimal.ZERO;

                entry.reservedQty = BigDecimal.ZERO;

                entry.issuedQty = BigDecimal.ZERO;

                entry.usedQty = BigDecimal.ZERO;

                entry.wastageQty = BigDecimal.ZERO;

                entry.balanceQty = req.requiredQty();

                entry.unit = req.unit();

                entry.bomReference = clean(req.bomReference());

                entry.bomAttachmentUrl = clean(req.bomAttachmentUrl());

                entry.sampleImageUrl = clean(req.sampleImageUrl());

                entry.remarks = clean(req.remarks());

                entry.stockDecision = VenFlowStockDecision.PENDING;

                entry.storeStatus = VenFlowStoreStatus.PENDING;

                entry.poStatus = VenFlowPoStatus.NOT_RAISED;

                entry.qcStatus = VenFlowQcStatus.NOT_REQUIRED;

                entry.issueStatus = VenFlowIssueStatus.NOT_RESERVED;

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

                VenFlowEntry entry = getVisibleOrThrow(id);

                if (entry.stage != VenFlowStage.INDENT_CREATED) {
                        throw badRequest(
                                        "Only an Engineering BOM / Indent can be sent to AKG Store.");
                }

                requireText(
                                entry.sampleImageUrl,
                                "Sample Image is required before sending to Store.");

                String currentActor = actor();

                entry.sentToStoreBy = currentActor;

                entry.sentToStoreAt = LocalDateTime.now();

                return transition(
                                entry,
                                VenFlowStage.SENT_TO_STORE,
                                "SENT_TO_STORE",
                                "Engineering sent BOM / Indent to AKG Store.");
        }

        /*
         * =========================================================
         * STORE - STOCK REVIEW
         * =========================================================
         */

        public VenFlowEntry storeReview(
                        UUID id,
                        StoreReviewRequest req) {
                access.requireStore();

                require(
                                req,
                                "Request body is required.");

                require(
                                req.stockDecision(),
                                "Stock decision is required.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                boolean allowedStage = entry.stage == VenFlowStage.SENT_TO_STORE
                                || entry.stage == VenFlowStage.STORE_REVIEWED
                                || entry.stage == VenFlowStage.STOCK_AVAILABLE;

                if (!allowedStage) {
                        throw badRequest(
                                        "AKG Store review is allowed only after Engineering sends the indent.");
                }

                BigDecimal required = zero(entry.requiredQty);

                BigDecimal available = zero(req.availableQty());

                switch (req.stockDecision()) {
                        case AVAILABLE -> {
                                if (req.availableQty() == null) {
                                        available = required;
                                }

                                if (available.compareTo(required) < 0) {
                                        throw badRequest(
                                                        "Use Partially Available when Available Qty is less than Required Qty.");
                                }
                        }

                        case PARTIALLY_AVAILABLE -> {
                                if (available.compareTo(
                                                BigDecimal.ZERO) <= 0) {
                                        throw badRequest(
                                                        "Available Qty must be greater than zero for Partially Available.");
                                }

                                if (available.compareTo(required) >= 0) {
                                        throw badRequest(
                                                        "Use Available when Available Qty is equal to or greater than Required Qty.");
                                }
                        }

                        case NOT_AVAILABLE,
                                        HOLD,
                                        PENDING ->
                                available = BigDecimal.ZERO;
                }

                String currentActor = actor();

                entry.stockDecision = req.stockDecision();

                entry.storeStatus = toStoreStatus(
                                req.stockDecision());

                entry.availableQty = available;

                entry.balanceQty = maxZero(
                                required.subtract(
                                                available));

                entry.storeReviewedBy = currentActor;

                entry.storeReviewedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                VenFlowStage nextStage;

                if (req.stockDecision() == VenFlowStockDecision.AVAILABLE
                                || req.stockDecision() == VenFlowStockDecision.PARTIALLY_AVAILABLE) {
                        nextStage = VenFlowStage.STOCK_AVAILABLE;
                } else if (req.stockDecision() == VenFlowStockDecision.PENDING) {
                        nextStage = VenFlowStage.SENT_TO_STORE;
                } else {
                        nextStage = VenFlowStage.STORE_REVIEWED;
                }

                return transition(
                                entry,
                                nextStage,
                                "STORE_REVIEWED",
                                "Store decision="
                                                + entry.stockDecision
                                                + ", available quantity="
                                                + entry.availableQty
                                                + ", balance quantity="
                                                + entry.balanceQty
                                                + ".");
        }

        public VenFlowEntry reserveMaterial(
                        UUID id,
                        ReserveMaterialRequest req) {
                access.requireStore();

                require(
                                req,
                                "Request body is required.");

                requirePositive(
                                req.reservedQty(),
                                "Reserved Qty must be greater than zero.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                boolean allowed = entry.stage == VenFlowStage.STOCK_AVAILABLE
                                || entry.stage == VenFlowStage.MATERIAL_ACCEPTED_IN_STORE;

                if (!allowed) {
                        throw badRequest(
                                        "Material can be reserved only after stock availability or QC OK inventory acceptance.");
                }

                BigDecimal maximumReservable;

                if (entry.stage == VenFlowStage.MATERIAL_ACCEPTED_IN_STORE) {
                        maximumReservable = calculateIssueReadyQty(entry);
                } else {
                        maximumReservable = zero(entry.availableQty);
                }

                if (req.reservedQty()
                                .compareTo(
                                                maximumReservable) > 0) {
                        throw badRequest(
                                        "Reserved Qty cannot exceed material available for this project.");
                }

                if (req.reservedQty()
                                .compareTo(
                                                zero(entry.requiredQty)) > 0) {
                        throw badRequest(
                                        "Reserved Qty cannot exceed Required Qty.");
                }

                String currentActor = actor();

                entry.reservedQty = req.reservedQty();

                entry.issueStatus = VenFlowIssueStatus.RESERVED;

                entry.balanceQty = maxZero(
                                zero(entry.requiredQty)
                                                .subtract(
                                                                entry.reservedQty));

                entry.reservedBy = currentActor;

                entry.reservedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                return transition(
                                entry,
                                VenFlowStage.MATERIAL_RESERVED,
                                "MATERIAL_RESERVED",
                                "Reserved quantity="
                                                + entry.reservedQty
                                                + " "
                                                + entry.unit
                                                + ", remaining balance="
                                                + entry.balanceQty
                                                + ".");
        }

        public VenFlowEntry raisePurchaseRequest(
                        UUID id,
                        PurchaseRequestRequest req) {
                access.requireStore();

                require(
                                req,
                                "Request body is required.");

                requireText(
                                req.purchaseRequestNo(),
                                "Purchase Request No. is required.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                boolean allowedStage = entry.stage == VenFlowStage.STORE_REVIEWED
                                || entry.stage == VenFlowStage.STOCK_AVAILABLE
                                || entry.stage == VenFlowStage.MATERIAL_RESERVED;

                if (!allowedStage) {
                        throw badRequest(
                                        "Store review must be completed before raising Purchase Request.");
                }

                boolean allowedDecision = entry.stockDecision == VenFlowStockDecision.NOT_AVAILABLE
                                || entry.stockDecision == VenFlowStockDecision.PARTIALLY_AVAILABLE
                                || entry.stockDecision == VenFlowStockDecision.HOLD;

                if (!allowedDecision) {
                        throw badRequest(
                                        "Purchase Request is allowed only for Not Available, Partially Available, or Hold stock.");
                }

                BigDecimal shortage = calculatePurchaseShortage(entry);

                if (shortage.compareTo(
                                BigDecimal.ZERO) <= 0) {
                        throw badRequest(
                                        "No purchase shortage remains for this requirement.");
                }

                String currentActor = actor();

                entry.purchaseRequestNo = clean(
                                req.purchaseRequestNo());

                entry.requisitionSlipNo = clean(
                                req.purchaseRequestNo());

                entry.requisitionDate = req.requisitionDate();

                /*
                 * Order only the shortage, not the complete requirement.
                 */
                entry.orderedQty = shortage;

                entry.balanceQty = shortage;

                entry.purchaseRequestBy = currentActor;

                entry.purchaseRequestAt = LocalDateTime.now();

                entry.sentToPurchaseBy = currentActor;

                entry.sentToPurchaseAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                return transition(
                                entry,
                                VenFlowStage.PURCHASE_REQUEST_RAISED,
                                "PURCHASE_REQUEST_RAISED",
                                "Purchase Request "
                                                + entry.purchaseRequestNo
                                                + " raised for shortage quantity "
                                                + entry.orderedQty
                                                + " "
                                                + entry.unit
                                                + ".");
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

                require(req, "Request body is required.");
                requireText(req.vendorName(), "Vendor Name is required.");
                requireText(req.poNo(), "PO No. is required.");
                require(req.poDate(), "PO Date is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                boolean allowed = e.stage == VenFlowStage.PURCHASE_REQUEST_RAISED
                                || e.stage == VenFlowStage.PO_REJECTED_BY_DIRECTOR;

                if (!allowed) {
                        throw badRequest(
                                        "PO can be prepared only after Purchase Request or Director rejection.");
                }

                if (req.poAmount() == null
                                || req.poAmount().compareTo(BigDecimal.ZERO) <= 0) {
                        throw badRequest(
                                        "PO Amount must be greater than zero.");
                }

                requireText(
                                req.poDocumentUrl(),
                                "PO Document is required before Director submission.");

                String currentActor = actor();

                e.vendorName = clean(req.vendorName());
                e.poNo = clean(req.poNo());
                e.poDate = req.poDate();
                e.poAmount = req.poAmount();
                e.poDocumentUrl = clean(req.poDocumentUrl());

                e.poStatus = VenFlowPoStatus.PENDING_DIRECTOR_APPROVAL;

                e.poRaisedBy = currentActor;
                e.poRaisedAt = LocalDateTime.now();

                e.poApprovalRequestedBy = currentActor;
                e.poApprovalRequestedAt = LocalDateTime.now();

                e.directorApprovalRemarks = null;
                e.directorApprovedBy = null;
                e.directorApprovedAt = null;
                e.directorRejectedBy = null;
                e.directorRejectedAt = null;

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                VenFlowEntry saved = transition(
                                e,
                                VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL,
                                "PO_SUBMITTED_FOR_DIRECTOR_APPROVAL",
                                "PO " + e.poNo
                                                + " for vendor "
                                                + e.vendorName
                                                + " and amount "
                                                + e.poAmount
                                                + " submitted for Director approval.");

                notificationService.publishPoApprovalRequired(saved);

                return saved;
        }

        @Deprecated
        public VenFlowEntry approvePo(
                        UUID id) {
                return directorApprovePo(
                                id,
                                new RemarksRequest(
                                                "Approved through legacy PO approval endpoint."));
        }

        public VenFlowEntry directorApprovePo(
                        UUID id,
                        RemarksRequest req) {
                access.requireDirector();

                VenFlowEntry entry = getVisibleOrThrow(id);

                if (entry.stage != VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL
                                || entry.poStatus != VenFlowPoStatus.PENDING_DIRECTOR_APPROVAL) {
                        throw badRequest(
                                        "Only a PO pending Director approval can be approved.");
                }

                String currentActor = actor();

                entry.poStatus = VenFlowPoStatus.DIRECTOR_APPROVED;

                entry.directorApprovalRemarks = req == null
                                ? null
                                : clean(req.remarks());

                entry.directorApprovedBy = currentActor;

                entry.directorApprovedAt = LocalDateTime.now();

                entry.directorRejectedBy = null;
                entry.directorRejectedAt = null;

                VenFlowEntry saved = transition(
                                entry,
                                VenFlowStage.PO_APPROVED_BY_DIRECTOR,
                                "PO_APPROVED_BY_DIRECTOR",
                                "Director approved PO "
                                                + entry.poNo
                                                + ".");

                notificationService
                                .publishPoApproved(saved);

                return saved;
        }

        public VenFlowEntry directorRejectPo(
                        UUID id,
                        RemarksRequest req) {
                access.requireDirector();

                require(
                                req,
                                "Decision body is required.");

                requireText(
                                req.remarks(),
                                "Return / rejection reason is required.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                if (entry.stage != VenFlowStage.PO_PENDING_DIRECTOR_APPROVAL
                                || entry.poStatus != VenFlowPoStatus.PENDING_DIRECTOR_APPROVAL) {
                        throw badRequest(
                                        "Only a PO pending Director approval can be returned.");
                }

                String currentActor = actor();

                entry.poStatus = VenFlowPoStatus.DIRECTOR_REJECTED;

                entry.directorApprovalRemarks = clean(req.remarks());

                entry.directorRejectedBy = currentActor;

                entry.directorRejectedAt = LocalDateTime.now();

                entry.directorApprovedBy = null;
                entry.directorApprovedAt = null;

                VenFlowEntry saved = transition(
                                entry,
                                VenFlowStage.PO_REJECTED_BY_DIRECTOR,
                                "PO_REJECTED_BY_DIRECTOR",
                                "Director returned PO "
                                                + entry.poNo
                                                + ". Reason: "
                                                + entry.directorApprovalRemarks);

                notificationService
                                .publishPoRejected(saved);

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

                require(
                                req,
                                "Vendor order body is required.");

                requireText(
                                req.vendorOrderReference(),
                                "Vendor Order Reference is required.");

                require(
                                req.vendorExpectedDate(),
                                "Vendor Expected Date is required.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                if (entry.stage != VenFlowStage.PO_APPROVED_BY_DIRECTOR
                                || entry.poStatus != VenFlowPoStatus.DIRECTOR_APPROVED) {
                        throw badRequest(
                                        "The vendor order can be placed only after Director approval.");
                }

                if (req.vendorExpectedDate()
                                .isBefore(LocalDate.now())) {
                        throw badRequest(
                                        "Vendor Expected Date cannot be before today.");
                }

                String currentActor = actor();

                entry.poStatus = VenFlowPoStatus.ORDER_PLACED;

                entry.vendorOrderReference = clean(
                                req.vendorOrderReference());

                entry.vendorAcknowledgementNo = clean(
                                req.vendorAcknowledgementNo());

                entry.vendorExpectedDate = req.vendorExpectedDate();

                entry.vendorOrderRemarks = clean(req.remarks());

                entry.vendorOrderPlacedBy = currentActor;

                entry.vendorOrderPlacedAt = LocalDateTime.now();

                VenFlowEntry saved = transition(
                                entry,
                                VenFlowStage.ORDER_PLACED_WITH_VENDOR,
                                "ORDER_PLACED_WITH_VENDOR",
                                "Purchase placed the approved order with vendor "
                                                + entry.vendorName
                                                + ". Vendor Order Reference: "
                                                + entry.vendorOrderReference
                                                + ".");

                notificationService
                                .publishVendorOrderPlaced(saved);

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

                require(
                                req,
                                "Request body is required.");

                requirePositive(
                                req.receivedQty(),
                                "Received Qty must be greater than zero.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                if (entry.stage != VenFlowStage.ORDER_PLACED_WITH_VENDOR
                                || entry.poStatus != VenFlowPoStatus.ORDER_PLACED) {
                        throw badRequest(
                                        "Director-approved PO must be placed with the vendor before material receiving.");
                }

                if (entry.orderedQty != null
                                && req.receivedQty()
                                                .compareTo(
                                                                entry.orderedQty) > 0) {
                        throw badRequest(
                                        "Received Qty cannot exceed Ordered Qty.");
                }

                String currentActor = actor();

                entry.receivedQty = req.receivedQty();

                entry.actualInHouseDate = req.actualInHouseDate();

                entry.balanceQty = calculateSupplyBalance(entry);

                entry.materialReceivedBy = currentActor;

                entry.materialReceivedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                VenFlowEntry saved = transition(
                                entry,
                                VenFlowStage.MATERIAL_RECEIVED_AT_STORE,
                                "MATERIAL_RECEIVED_AT_STORE",
                                "Store received "
                                                + entry.receivedQty
                                                + " "
                                                + entry.unit
                                                + ". Remaining supply balance="
                                                + entry.balanceQty
                                                + ".");

                notificationService
                                .publishMaterialReceived(saved);

                return saved;
        }

        public VenFlowEntry grnEntry(
                        UUID id,
                        GrnRequest req) {
                access.requireStore();

                require(
                                req,
                                "Request body is required.");

                requireText(
                                req.grnNo(),
                                "GRN No. is required.");

                require(
                                req.grnDate(),
                                "GRN Date is required.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                if (entry.stage != VenFlowStage.MATERIAL_RECEIVED_AT_STORE) {
                        throw badRequest(
                                        "Material must be received before GRN entry.");
                }

                entry.grnNo = clean(req.grnNo());

                entry.grnDate = req.grnDate();

                entry.grnBy = actor();

                entry.grnAt = LocalDateTime.now();

                entry.qcStatus = VenFlowQcStatus.PENDING;

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                return transition(
                                entry,
                                VenFlowStage.GRN_DONE,
                                "GRN_DONE",
                                "GRN "
                                                + entry.grnNo
                                                + " completed. QC is now pending.");
        }

        public VenFlowEntry qualityCheck(
                        UUID id,
                        QcRequest req) {
                access.requireStore();

                require(
                                req,
                                "Request body is required.");

                require(
                                req.qcStatus(),
                                "QC Status is required.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                boolean allowed = entry.stage == VenFlowStage.GRN_DONE
                                || entry.stage == VenFlowStage.QC_PENDING;

                if (!allowed) {
                        throw badRequest(
                                        "GRN must be completed before QC.");
                }

                boolean rejectionStatus = req.qcStatus() == VenFlowQcStatus.NOT_OK
                                || req.qcStatus() == VenFlowQcStatus.HOLD
                                || req.qcStatus() == VenFlowQcStatus.RETURN_TO_VENDOR;

                if (rejectionStatus) {
                        requireText(
                                        req.rejectionReason(),
                                        "Rejection / Hold reason is required.");
                }

                String currentActor = actor();

                entry.qcStatus = req.qcStatus();

                entry.qcRemarks = clean(req.qcRemarks());

                entry.rejectionReason = clean(req.rejectionReason());

                entry.qcCheckedBy = currentActor;

                entry.qcCheckedAt = LocalDateTime.now();

                VenFlowStage nextStage;

                if (req.qcStatus() == VenFlowQcStatus.OK) {
                        nextStage = VenFlowStage.QC_OK;
                } else if (req.qcStatus() == VenFlowQcStatus.PENDING) {
                        nextStage = VenFlowStage.QC_PENDING;
                } else {
                        nextStage = VenFlowStage.MATERIAL_REJECTED_HOLD_RETURN;

                        entry.storeStatus = VenFlowStoreStatus.HOLD;
                }

                return transition(
                                entry,
                                nextStage,
                                "QUALITY_CHECK",
                                "QC status="
                                                + entry.qcStatus
                                                + (hasText(entry.rejectionReason)
                                                                ? ", reason="
                                                                                + entry.rejectionReason
                                                                : "")
                                                + ".");
        }

        public VenFlowEntry acceptInventory(
                        UUID id) {
                access.requireStore();

                VenFlowEntry entry = getVisibleOrThrow(id);

                if (entry.stage != VenFlowStage.QC_OK) {
                        throw badRequest(
                                        "QC must be OK before accepting material into Store Inventory.");
                }

                String currentActor = actor();

                entry.storeStatus = VenFlowStoreStatus.AVAILABLE_IN_STORE;

                entry.inventoryAcceptedBy = currentActor;

                entry.inventoryAcceptedAt = LocalDateTime.now();

                entry.balanceQty = calculateSupplyBalance(entry);

                return transition(
                                entry,
                                VenFlowStage.MATERIAL_ACCEPTED_IN_STORE,
                                "MATERIAL_ACCEPTED_IN_STORE",
                                "QC-approved material accepted into Store Inventory by "
                                                + currentActor
                                                + ".");
        }

        @Deprecated
        public VenFlowEntry informProduction(UUID id) {
                access.requireStore();

                VenFlowEntry e = getVisibleOrThrow(id);

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

                require(
                                req,
                                "Request body is required.");

                requirePositive(
                                req.issuedQty(),
                                "Issued Qty must be greater than zero.");

                requireText(
                                req.issuedTo(),
                                "Issued To / Responsible Person is required.");

                VenFlowEntry entry = getVisibleOrThrow(id);

                boolean allowed = entry.stage == VenFlowStage.MATERIAL_RESERVED
                                || entry.stage == VenFlowStage.MATERIAL_ACCEPTED_IN_STORE;

                if (!allowed) {
                        throw badRequest(
                                        "Material can be issued only after reservation or QC OK Store Inventory acceptance.");
                }

                BigDecimal readyQty = calculateIssueReadyQty(entry);

                if (readyQty.compareTo(
                                BigDecimal.ZERO) <= 0) {
                        readyQty = min(
                                        zero(entry.requiredQty),
                                        zero(entry.availableQty));
                }

                if (req.issuedQty()
                                .compareTo(
                                                readyQty) > 0) {
                        throw badRequest(
                                        "Issued Qty cannot exceed reserved plus received material.");
                }

                if (req.issuedQty()
                                .compareTo(
                                                zero(entry.requiredQty)) > 0) {
                        throw badRequest(
                                        "Issued Qty cannot exceed Required Qty.");
                }

                String currentActor = actor();

                entry.issuedQty = req.issuedQty();

                entry.issuedTo = clean(req.issuedTo());

                entry.issueStatus = VenFlowIssueStatus.ISSUED;

                entry.productionStatus = VenFlowProductionStatus.NOT_STARTED;

                entry.balanceQty = maxZero(
                                zero(entry.requiredQty)
                                                .subtract(
                                                                entry.issuedQty));

                entry.issuedBy = currentActor;

                entry.issuedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                return transition(
                                entry,
                                VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION,
                                "MATERIAL_ISSUED_TO_PRODUCTION",
                                "Issued "
                                                + entry.issuedQty
                                                + " "
                                                + entry.unit
                                                + " to "
                                                + entry.issuedTo
                                                + ". Remaining balance="
                                                + entry.balanceQty
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

                VenFlowEntry e = getVisibleOrThrow(id);

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

                VenFlowEntry entry = getVisibleOrThrow(id);

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

                VenFlowEntry entry = getVisibleOrThrow(id);

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

                requireText(
                                req.outputImageUrl(),
                                "Output Image is required for process completion.");

                requireText(
                                entry.supervisorName,
                                "Responsible Person / Supervisor is required before completion.");

                BigDecimal issued = zero(entry.issuedQty);

                BigDecimal used = req.usedQty();

                BigDecimal wastage = req.wastageQty();

                BigDecimal calculatedBalance = issued
                                .subtract(used)
                                .subtract(wastage);

                if (calculatedBalance.compareTo(
                                BigDecimal.ZERO) < 0) {
                        throw badRequest(
                                        "Used Qty plus Wastage Qty cannot exceed Issued Qty.");
                }

                if (req.balanceQty() != null
                                && req.balanceQty()
                                                .compareTo(
                                                                calculatedBalance) != 0) {
                        throw badRequest(
                                        "Balance Qty must equal Issued Qty minus Used Qty minus Wastage Qty.");
                }

                String currentActor = actor();

                entry.usedQty = used;

                entry.wastageQty = wastage;

                entry.balanceQty = calculatedBalance;

                entry.outputImageUrl = clean(req.outputImageUrl());

                entry.processingStatus = VenFlowProcessingStatus.COMPLETED;

                entry.productionStatus = VenFlowProductionStatus.DONE;

                entry.processCompletedBy = currentActor;

                entry.processCompletedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        entry.remarks = clean(req.remarks());
                }

                return transition(
                                entry,
                                VenFlowStage.PROCESS_COMPLETED,
                                "PROCESS_COMPLETED",
                                "Processing completed. Issued="
                                                + entry.issuedQty
                                                + ", used="
                                                + entry.usedQty
                                                + ", wastage="
                                                + entry.wastageQty
                                                + ", balance="
                                                + entry.balanceQty
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

                VenFlowEntry entry = getVisibleOrThrow(id);

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

                VenFlowEntry entry = getVisibleOrThrow(id);

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
                                                VenFlowStage.MATERIAL_RECEIVED_AT_STORE,
                                                VenFlowStage.PO_RAISED)));

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

                VenFlowEntry e = getVisibleOrThrow(id);

                String oldValue = e.remarks;

                e.remarks = req.remarks();
                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "UPDATE_REMARKS", oldValue, saved.remarks);

                return saved;
        }

        public VenFlowEntry updateProductDetails(UUID id, ProductDetailsRequest req) {
                access.requireEngineering();

                require(req, "Request body is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                String oldValue = "Product=" + e.productDescription
                                + ", Veneer=" + e.veneerType
                                + ", Size=" + e.size;

                e.productDescription = clean(req.productDescription());
                e.materialName = clean(req.productDescription());
                e.veneerType = clean(req.veneerType());
                e.size = clean(req.size());

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "UPDATE_PRODUCT_DETAILS", oldValue,
                                "Product=" + saved.productDescription
                                                + ", Veneer=" + saved.veneerType
                                                + ", Size=" + saved.size);

                return saved;
        }

        public VenFlowEntry updateStoreStatus(
                        UUID id,
                        StoreStatusRequest req) {
                access.requireStore();

                require(
                                req,
                                "Request body is required.");

                require(
                                req.storeStatus(),
                                "Store Status is required.");

                VenFlowStockDecision decision = switch (req.storeStatus()) {
                        case AVAILABLE_IN_STORE ->
                                VenFlowStockDecision.AVAILABLE;

                        case PARTIALLY_AVAILABLE ->
                                VenFlowStockDecision.PARTIALLY_AVAILABLE;

                        case NOT_AVAILABLE ->
                                VenFlowStockDecision.NOT_AVAILABLE;

                        case HOLD ->
                                VenFlowStockDecision.HOLD;

                        case PENDING ->
                                VenFlowStockDecision.PENDING;
                };

                VenFlowEntry entry = getVisibleOrThrow(id);

                return storeReview(
                                id,
                                new StoreReviewRequest(
                                                decision,
                                                entry.availableQty,
                                                "Updated through legacy store-status endpoint."));
        }

        public VenFlowEntry sendToPurchase(UUID id) {
                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stockDecision == null || e.stockDecision == VenFlowStockDecision.PENDING) {
                        e.stockDecision = VenFlowStockDecision.NOT_AVAILABLE;
                        entryRepo.save(e);
                }

                return raisePurchaseRequest(
                                id,
                                new PurchaseRequestRequest(
                                                hasText(e.purchaseRequestNo)
                                                                ? e.purchaseRequestNo
                                                                : "PR-" + id.toString().substring(0, 8).toUpperCase(),
                                                LocalDate.now(),
                                                "Created from legacy send-to-purchase endpoint."));
        }

        public VenFlowEntry updateRequisition(UUID id, RequisitionRequest req) {
                require(req, "Request body is required.");

                return raisePurchaseRequest(
                                id,
                                new PurchaseRequestRequest(
                                                req.requisitionSlipNo(),
                                                req.requisitionDate(),
                                                "Updated from legacy requisition endpoint."));
        }

        public VenFlowEntry updateOrderedQty(UUID id, OrderedQtyRequest req) {
                access.requirePurchase();

                require(req, "Request body is required.");
                require(req.orderedQty(), "Ordered Qty is required.");
                require(req.unit(), "Unit is required.");

                if (req.orderedQty().compareTo(BigDecimal.ZERO) <= 0) {
                        throw badRequest("Ordered Qty must be greater than zero.");
                }

                VenFlowEntry e = getVisibleOrThrow(id);

                String oldValue = "Ordered=" + e.orderedQty
                                + ", Unit=" + e.unit
                                + ", Balance=" + e.balanceQty;

                e.orderedQty = req.orderedQty();
                e.unit = req.unit();
                e.balanceQty = calculateBalance(e.requiredQty, e.receivedQty);
                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "UPDATE_ORDERED_QTY", oldValue,
                                "Ordered=" + saved.orderedQty
                                                + ", Unit=" + saved.unit
                                                + ", Balance=" + saved.balanceQty);

                return saved;
        }

        public VenFlowEntry updateExpectedDate(UUID id, ExpectedDateRequest req) {
                access.requireEngineering();

                require(req, "Request body is required.");
                require(req.expectedDate(), "Expected Date is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                String oldValue = String.valueOf(e.expectedDate);

                e.expectedDate = req.expectedDate();
                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "UPDATE_EXPECTED_DATE", oldValue, String.valueOf(saved.expectedDate));

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
                VenFlowEntry entry = getVisibleOrThrow(id);

                String remarks = req == null
                                ? "Completed through legacy job-done endpoint."
                                : req.remarks();

                return completeProcess(
                                id,
                                new ProcessingRequest(
                                                entry.usedQty,
                                                entry.wastageQty,
                                                entry.balanceQty,
                                                entry.outputImageUrl,
                                                remarks));
        }

        public VenFlowEntry complete(UUID id) {
                return jobDone(
                                id,
                                new ProductionActionRequest("Completed from legacy complete endpoint."));
        }

        /*
         * =========================================================
         * VALIDATION / ACCESS HELPERS
         * =========================================================
         */

        private void requireHeader(VenFlowEntry e) {
                require(e.orderDate, "Order Date must be entered first.");
                requireText(e.pdNo, "PD No. must be entered first.");
                requireText(e.clientName, "Client Name must be entered first.");
                requireText(e.plantCode, "Plant must be entered first.");
        }

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

        private BigDecimal calculateBalance(
                        BigDecimal requiredQty,
                        BigDecimal receivedQty) {
                if (requiredQty == null) {
                        return null;
                }

                return maxZero(
                                requiredQty.subtract(
                                                zero(receivedQty)));
        }

        private Specification<VenFlowEntry> visibleSpec() {
                Set<String> plants = access.allowedPlantCodes();

                /*
                 * ADMIN always sees all VenFlow entries.
                 * VenFlow Manager sees all only when no plant restriction is assigned.
                 */
                boolean allPlants = access.isAdmin()
                                || (access.isVenFlowManager()
                                                && plants.isEmpty());

                return VenFlowSpecifications.visiblePlants(
                                plants,
                                allPlants);
        }

        private VenFlowEntry getVisibleOrThrow(UUID id) {
                VenFlowEntry e = entryRepo.findById(id)
                                .orElseThrow(() -> notFound("VenFlow entry not found."));

                access.assertPlantAccess(e.plantCode);

                return e;
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

        private BigDecimal calculateSupplyBalance(
                        VenFlowEntry e) {
                BigDecimal required = zero(e.requiredQty);

                BigDecimal reserved = zero(e.reservedQty);
                BigDecimal received = zero(e.receivedQty);

                return maxZero(
                                required
                                                .subtract(reserved)
                                                .subtract(received));
        }

        private BigDecimal calculateIssueReadyQty(
                        VenFlowEntry entry) {
                BigDecimal totalReady = zero(entry.reservedQty)
                                .add(
                                                zero(entry.receivedQty));

                /*
                 * Never allow the calculated issue-ready quantity to exceed
                 * the original project requirement.
                 */
                return min(
                                zero(entry.requiredQty),
                                totalReady);
        }

        private BigDecimal calculatePurchaseShortage(
                        VenFlowEntry entry) {
                BigDecimal required = zero(entry.requiredQty);

                BigDecimal reserved = zero(entry.reservedQty);

                BigDecimal available = zero(entry.availableQty);

                /*
                 * Reserved quantity is part of available stock.
                 * Use the higher committed-stock figure; do not add both.
                 */
                BigDecimal committedStock = reserved.compareTo(available) >= 0
                                ? reserved
                                : available;

                return maxZero(
                                required.subtract(
                                                committedStock));
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

                VenFlowStage previousStage = entry.stage;

                boolean newEntry = entry.id == null;

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
}