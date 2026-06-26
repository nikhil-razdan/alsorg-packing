package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.VenFlowDtos.*;
import com.alsorg.packing.domain.venflow.*;
import com.alsorg.packing.repository.VenFlowAuditLogRepository;
import com.alsorg.packing.repository.VenFlowEntryRepository;

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

    public VenFlowService(
            VenFlowEntryRepository entryRepo,
            VenFlowAuditLogRepository auditRepo,
            VenFlowAccessService access) {
        this.entryRepo = entryRepo;
        this.auditRepo = auditRepo;
        this.access = access;
    }

    /*
     * =========================================================
     * CREATE - PRODUCTION RAISES VENEER REQUIREMENT
     * =========================================================
     */

    public VenFlowEntry create(CreateRequest req) {
        access.requireProduction();

        require(req, "Request body is required.");
        requireText(req.plantCode(), "Plant is required.");
        require(req.orderDate(), "Order Date is required.");
        requireText(req.pdNo(), "PD No. is required.");
        requireText(req.clientName(), "Client Name is required.");

        String plantCode = cleanUpper(req.plantCode());

        access.assertPlantAccess(plantCode);

        VenFlowEntry e = new VenFlowEntry();

        e.plantCode = plantCode;
        e.orderDate = req.orderDate();
        e.pdNo = clean(req.pdNo());
        e.clientName = clean(req.clientName());

        e.bomReference = clean(req.bomReference());
        e.bomAttachmentUrl = clean(req.bomAttachmentUrl());

        e.stage = VenFlowStage.PRODUCTION_RAISED;
        e.poStatus = VenFlowPoStatus.NOT_RAISED;
        e.productionStatus = VenFlowProductionStatus.NOT_STARTED;

        e.raisedBy = actor();
        e.raisedAt = LocalDateTime.now();

        e.createdBy = actor();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                saved.id,
                "PRODUCTION_RAISED",
                null,
                "Plant=" + saved.plantCode
                        + ", Order Date=" + saved.orderDate
                        + ", PD No=" + saved.pdNo
                        + ", Client=" + saved.clientName
                        + ", BOM=" + saved.bomReference);

        return saved;
    }

    /*
     * =========================================================
     * LIST - PLANT-WISE / ACCESS-WISE
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

    /*
     * =========================================================
     * PURCHASE DESK
     * =========================================================
     */

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
                        VenFlowStage.SENT_TO_PURCHASE,
                        VenFlowStage.PO_RAISED,
                        VenFlowStage.PO_APPROVED)));

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "sentToPurchaseAt")
                        .and(Sort.by(Sort.Direction.DESC, "createdAt")));

        return entryRepo.findAll(spec, pageable);
    }

    /*
     * =========================================================
     * GET SINGLE ENTRY - ACCESS SAFE
     * =========================================================
     */

    @Transactional(readOnly = true)
    public VenFlowEntry get(UUID id) {
        return getVisibleOrThrow(id);
    }

    /*
     * =========================================================
     * PRODUCTION - PRODUCT DETAILS
     * =========================================================
     */

    public VenFlowEntry updateProductDetails(
            UUID id,
            ProductDetailsRequest req) {
        access.requireProduction();

        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        requireHeader(e);

        requireText(req.productDescription(), "Product Description is required.");
        requireText(req.veneerType(), "Veneer Type is required.");
        requireText(req.size(), "Size is required.");

        String oldValue = "Product=" + e.productDescription
                + ", Veneer=" + e.veneerType
                + ", Size=" + e.size;

        e.productDescription = clean(req.productDescription());
        e.veneerType = clean(req.veneerType());
        e.size = clean(req.size());

        if (e.stage == null || e.stage == VenFlowStage.HEADER_CREATED) {
            e.stage = VenFlowStage.PRODUCTION_RAISED;
        }

        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "UPDATE_PRODUCT_DETAILS",
                oldValue,
                "Product=" + saved.productDescription
                        + ", Veneer=" + saved.veneerType
                        + ", Size=" + saved.size);

        return saved;
    }

    /*
     * =========================================================
     * STORE - REVIEW STATUS
     * =========================================================
     */

    public VenFlowEntry updateStoreStatus(
            UUID id,
            StoreStatusRequest req) {
        access.requireStore();

        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        requireProductDetails(e);
        require(req.storeStatus(), "Store Status is required.");

        String oldValue = String.valueOf(e.storeStatus);

        e.storeStatus = req.storeStatus();
        e.stage = VenFlowStage.STORE_REVIEWED;
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "STORE_REVIEWED",
                oldValue,
                String.valueOf(saved.storeStatus));

        return saved;
    }

    /*
     * =========================================================
     * STORE - SEND TO PURCHASE
     * =========================================================
     */

    public VenFlowEntry sendToPurchase(UUID id) {
        access.requireStore();

        VenFlowEntry e = getVisibleOrThrow(id);

        requireProductDetails(e);
        require(e.storeStatus, "Store Status must be updated before sending to Purchase.");

        if (e.stage != VenFlowStage.STORE_REVIEWED
                && e.stage != VenFlowStage.STORE_STATUS_UPDATED) {
            throw badRequest("Store must review the entry before sending to Purchase.");
        }

        String oldValue = String.valueOf(e.stage);

        e.stage = VenFlowStage.SENT_TO_PURCHASE;
        e.sentToPurchaseBy = actor();
        e.sentToPurchaseAt = LocalDateTime.now();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "SENT_TO_PURCHASE",
                oldValue,
                String.valueOf(saved.stage));

        return saved;
    }

    /*
     * =========================================================
     * PURCHASE - REQUISITION
     * =========================================================
     */

    public VenFlowEntry updateRequisition(
            UUID id,
            RequisitionRequest req) {
        access.requirePurchase();

        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        requireSentToPurchase(e);

        requireText(req.requisitionSlipNo(), "Requisition Slip No. is required.");
        require(req.requisitionDate(), "Requisition Date is required.");

        String oldValue = "Slip=" + e.requisitionSlipNo
                + ", Date=" + e.requisitionDate;

        e.requisitionSlipNo = clean(req.requisitionSlipNo());
        e.requisitionDate = req.requisitionDate();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "UPDATE_REQUISITION",
                oldValue,
                "Slip=" + saved.requisitionSlipNo
                        + ", Date=" + saved.requisitionDate);

        return saved;
    }

    /*
     * =========================================================
     * PURCHASE - ORDERED QUANTITY
     * =========================================================
     */

    public VenFlowEntry updateOrderedQty(
            UUID id,
            OrderedQtyRequest req) {
        access.requirePurchase();

        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        requireSentToPurchase(e);
        requireRequisition(e);

        require(req.orderedQty(), "Ordered Qty is required.");
        require(req.unit(), "Unit is required.");

        if (req.orderedQty().compareTo(BigDecimal.ZERO) <= 0) {
            throw badRequest("Ordered Qty must be greater than zero.");
        }

        String oldValue = "Ordered=" + e.orderedQty
                + ", Unit=" + e.unit
                + ", Balance=" + e.balanceQty;

        e.orderedQty = req.orderedQty();
        e.unit = req.unit();
        e.balanceQty = calculateBalance(e.orderedQty, e.receivedQty);
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "UPDATE_ORDERED_QTY",
                oldValue,
                "Ordered=" + saved.orderedQty
                        + ", Unit=" + saved.unit
                        + ", Balance=" + saved.balanceQty);

        return saved;
    }

    /*
     * =========================================================
     * PURCHASE - RAISE PO
     * =========================================================
     */

    public VenFlowEntry raisePo(
            UUID id,
            PoRequest req) {
        access.requirePurchase();

        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        requireSentToPurchase(e);
        requireRequisition(e);
        requireOrderedQty(e);

        requireText(req.vendorName(), "Vendor Name is required.");
        requireText(req.poNo(), "PO No. is required.");
        require(req.poDate(), "PO Date is required.");

        String oldValue = "PO=" + e.poNo
                + ", Vendor=" + e.vendorName
                + ", Status=" + e.poStatus;

        e.vendorName = clean(req.vendorName());
        e.poNo = clean(req.poNo());
        e.poDate = req.poDate();
        e.poAmount = req.poAmount();
        e.poDocumentUrl = clean(req.poDocumentUrl());

        e.poStatus = VenFlowPoStatus.RAISED;
        e.stage = VenFlowStage.PO_RAISED;

        e.poRaisedBy = actor();
        e.poRaisedAt = LocalDateTime.now();

        if (hasText(req.remarks())) {
            e.remarks = clean(req.remarks());
        }

        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "PO_RAISED",
                oldValue,
                "PO=" + saved.poNo
                        + ", Vendor=" + saved.vendorName
                        + ", Status=" + saved.poStatus);

        return saved;
    }

    /*
     * =========================================================
     * MANAGER / ADMIN - APPROVE PO
     * =========================================================
     */

    public VenFlowEntry approvePo(UUID id) {
        access.requireManagerApproval();

        VenFlowEntry e = getVisibleOrThrow(id);

        if (e.poStatus != VenFlowPoStatus.RAISED) {
            throw badRequest("PO must be raised before approval.");
        }

        String oldValue = "PO Status=" + e.poStatus
                + ", Stage=" + e.stage;

        e.poStatus = VenFlowPoStatus.APPROVED;
        e.stage = VenFlowStage.PO_APPROVED;

        e.poApprovedBy = actor();
        e.poApprovedAt = LocalDateTime.now();

        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "PO_APPROVED",
                oldValue,
                "PO Status=" + saved.poStatus
                        + ", Stage=" + saved.stage);

        return saved;
    }

    /*
     * =========================================================
     * PRODUCTION - EXPECTED DATE
     * =========================================================
     */

    public VenFlowEntry updateExpectedDate(
            UUID id,
            ExpectedDateRequest req) {
        access.requireProduction();

        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        requireOrderedQty(e);
        require(req.expectedDate(), "Expected Date is required.");

        String oldValue = String.valueOf(e.expectedDate);

        e.expectedDate = req.expectedDate();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "UPDATE_EXPECTED_DATE",
                oldValue,
                String.valueOf(saved.expectedDate));

        return saved;
    }

    /*
     * =========================================================
     * OLD RECEIVED QTY ENDPOINT - KEPT FOR COMPATIBILITY
     * =========================================================
     */

    public VenFlowEntry updateReceivedQty(
            UUID id,
            ReceivedQtyRequest req) {
        require(req, "Request body is required.");

        MaterialReceivedRequest materialReq = new MaterialReceivedRequest(
                req.receivedQty(),
                req.actualInHouseDate(),
                null);

        return materialReceived(id, materialReq);
    }

    /*
     * =========================================================
     * STORE - MATERIAL RECEIVED
     * =========================================================
     */

    public VenFlowEntry materialReceived(
            UUID id,
            MaterialReceivedRequest req) {
        access.requireStore();

        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        if (e.poStatus != VenFlowPoStatus.APPROVED) {
            throw badRequest("PO must be approved before material receiving.");
        }

        require(req.receivedQty(), "Received Qty is required.");

        if (req.receivedQty().compareTo(BigDecimal.ZERO) < 0) {
            throw badRequest("Received Qty cannot be negative.");
        }

        String oldValue = "Received=" + e.receivedQty
                + ", Balance=" + e.balanceQty
                + ", Actual In-house=" + e.actualInHouseDate
                + ", Stage=" + e.stage;

        e.receivedQty = req.receivedQty();
        e.actualInHouseDate = req.actualInHouseDate();
        e.balanceQty = calculateBalance(e.orderedQty, e.receivedQty);

        e.stage = VenFlowStage.MATERIAL_RECEIVED;
        e.materialReceivedBy = actor();
        e.materialReceivedAt = LocalDateTime.now();

        if (hasText(req.remarks())) {
            e.remarks = clean(req.remarks());
        }

        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "MATERIAL_RECEIVED",
                oldValue,
                "Received=" + saved.receivedQty
                        + ", Balance=" + saved.balanceQty
                        + ", Actual In-house=" + saved.actualInHouseDate
                        + ", Stage=" + saved.stage);

        return saved;
    }

    /*
     * =========================================================
     * STORE - INFORM PRODUCTION
     * THIS WAS MISSING IN YOUR SERVICE
     * =========================================================
     */

    public VenFlowEntry informProduction(UUID id) {
        access.requireStore();

        VenFlowEntry e = getVisibleOrThrow(id);

        if (e.stage != VenFlowStage.MATERIAL_RECEIVED) {
            throw badRequest("Material must be received before informing Production.");
        }

        String oldValue = String.valueOf(e.stage);

        e.stage = VenFlowStage.MATERIAL_INFORMED;
        e.materialInformedBy = actor();
        e.materialInformedAt = LocalDateTime.now();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "MATERIAL_INFORMED",
                oldValue,
                String.valueOf(saved.stage));

        return saved;
    }

    /*
     * =========================================================
     * PRODUCTION - START PRODUCTION
     * =========================================================
     */

    public VenFlowEntry startProduction(
            UUID id,
            ProductionActionRequest req) {
        access.requireProduction();

        VenFlowEntry e = getVisibleOrThrow(id);

        if (e.stage != VenFlowStage.MATERIAL_INFORMED) {
            throw badRequest("Production can start only after Store informs material received.");
        }

        String oldValue = "Production Status=" + e.productionStatus
                + ", Stage=" + e.stage;

        e.productionStatus = VenFlowProductionStatus.STARTED;
        e.stage = VenFlowStage.PRODUCTION_STARTED;

        e.productionStartedBy = actor();
        e.productionStartedAt = LocalDateTime.now();

        if (req != null && hasText(req.remarks())) {
            e.remarks = clean(req.remarks());
        }

        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "PRODUCTION_STARTED",
                oldValue,
                "Production Status=" + saved.productionStatus
                        + ", Stage=" + saved.stage);

        return saved;
    }

    /*
     * =========================================================
     * PRODUCTION - JOB DONE
     * =========================================================
     */

    public VenFlowEntry jobDone(
            UUID id,
            ProductionActionRequest req) {
        access.requireProduction();

        VenFlowEntry e = getVisibleOrThrow(id);

        if (e.stage != VenFlowStage.PRODUCTION_STARTED) {
            throw badRequest("Production must be started before marking Job Done.");
        }

        String oldValue = "Production Status=" + e.productionStatus
                + ", Stage=" + e.stage;

        e.productionStatus = VenFlowProductionStatus.DONE;
        e.stage = VenFlowStage.JOB_DONE;

        e.jobDoneBy = actor();
        e.jobDoneAt = LocalDateTime.now();

        if (req != null && hasText(req.remarks())) {
            e.remarks = clean(req.remarks());
        }

        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "JOB_DONE",
                oldValue,
                "Production Status=" + saved.productionStatus
                        + ", Stage=" + saved.stage);

        return saved;
    }

    /*
     * =========================================================
     * OLD COMPLETE ENDPOINT - MAPS TO JOB DONE
     * =========================================================
     */

    public VenFlowEntry complete(UUID id) {
        access.requireProduction();

        VenFlowEntry e = getVisibleOrThrow(id);

        if (e.stage == VenFlowStage.JOB_DONE) {
            return e;
        }

        if (e.stage != VenFlowStage.PRODUCTION_STARTED) {
            throw badRequest("Production must be started before completing the job.");
        }

        return jobDone(
                id,
                new ProductionActionRequest("Completed from old complete endpoint."));
    }

    /*
     * =========================================================
     * REMARKS
     * =========================================================
     */

    public VenFlowEntry updateRemarks(
            UUID id,
            RemarksRequest req) {
        require(req, "Request body is required.");

        VenFlowEntry e = getVisibleOrThrow(id);

        String oldValue = e.remarks;

        e.remarks = req.remarks();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(
                id,
                "UPDATE_REMARKS",
                oldValue,
                saved.remarks);

        return saved;
    }

    /*
     * =========================================================
     * DASHBOARD
     * =========================================================
     */

    @Transactional(readOnly = true)
    public DashboardResponse dashboard() {
        List<VenFlowEntry> all = entryRepo.findAll(visibleSpec());

        LocalDate today = LocalDate.now();

        long total = all.size();

        long pendingStoreCheck = all.stream()
                .filter(e -> e.stage == VenFlowStage.PRODUCTION_RAISED)
                .count();

        long pendingRequisition = all.stream()
                .filter(e -> e.stage == VenFlowStage.SENT_TO_PURCHASE)
                .filter(e -> !hasText(e.requisitionSlipNo))
                .count();

        long pendingOrderQty = all.stream()
                .filter(e -> e.stage == VenFlowStage.SENT_TO_PURCHASE)
                .filter(e -> hasText(e.requisitionSlipNo))
                .filter(e -> e.orderedQty == null)
                .count();

        long pendingReceiving = all.stream()
                .filter(e -> e.stage == VenFlowStage.PO_APPROVED)
                .count();

        long balancePending = all.stream()
                .filter(e -> e.balanceQty != null)
                .filter(e -> e.balanceQty.compareTo(BigDecimal.ZERO) > 0)
                .count();

        long delayedItems = all.stream()
                .filter(e -> e.expectedDate != null)
                .filter(e -> e.expectedDate.isBefore(today))
                .filter(e -> e.stage != VenFlowStage.JOB_DONE)
                .count();

        long completedEntries = all.stream()
                .filter(e -> e.stage == VenFlowStage.JOB_DONE)
                .count();

        long sentToPurchase = all.stream()
                .filter(e -> e.stage == VenFlowStage.SENT_TO_PURCHASE)
                .count();

        long pendingPoRaise = all.stream()
                .filter(e -> e.stage == VenFlowStage.SENT_TO_PURCHASE)
                .filter(e -> e.poStatus == VenFlowPoStatus.NOT_RAISED)
                .count();

        long pendingPoApproval = all.stream()
                .filter(e -> e.stage == VenFlowStage.PO_RAISED)
                .filter(e -> e.poStatus == VenFlowPoStatus.RAISED)
                .count();

        long pendingMaterialReceiving = all.stream()
                .filter(e -> e.stage == VenFlowStage.PO_APPROVED)
                .count();

        long materialReceivedNotInformed = all.stream()
                .filter(e -> e.stage == VenFlowStage.MATERIAL_RECEIVED)
                .count();

        long productionNotStarted = all.stream()
                .filter(e -> e.stage == VenFlowStage.MATERIAL_INFORMED)
                .count();

        long productionStarted = all.stream()
                .filter(e -> e.stage == VenFlowStage.PRODUCTION_STARTED)
                .count();

        long jobDone = all.stream()
                .filter(e -> e.stage == VenFlowStage.JOB_DONE)
                .count();

        long totalPendingWorkLoading = all.stream()
                .filter(e -> e.stage != VenFlowStage.JOB_DONE)
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

    /*
     * =========================================================
     * REPORT SUMMARY
     * =========================================================
     */

    @Transactional(readOnly = true)
    public ReportSummaryResponse reportSummary() {
        List<VenFlowEntry> all = entryRepo.findAll(visibleSpec());

        LocalDate today = LocalDate.now();

        long totalOrders = all.size();

        long pendingStoreCheck = all.stream()
                .filter(e -> e.stage == VenFlowStage.PRODUCTION_RAISED)
                .count();

        long sentToPurchase = all.stream()
                .filter(e -> e.stage == VenFlowStage.SENT_TO_PURCHASE)
                .count();

        long pendingPoRaise = all.stream()
                .filter(e -> e.stage == VenFlowStage.SENT_TO_PURCHASE)
                .filter(e -> e.poStatus == VenFlowPoStatus.NOT_RAISED)
                .count();

        long pendingPoApproval = all.stream()
                .filter(e -> e.stage == VenFlowStage.PO_RAISED)
                .filter(e -> e.poStatus == VenFlowPoStatus.RAISED)
                .count();

        long pendingMaterialReceiving = all.stream()
                .filter(e -> e.stage == VenFlowStage.PO_APPROVED)
                .count();

        long materialReceivedNotInformed = all.stream()
                .filter(e -> e.stage == VenFlowStage.MATERIAL_RECEIVED)
                .count();

        long productionNotStarted = all.stream()
                .filter(e -> e.stage == VenFlowStage.MATERIAL_INFORMED)
                .count();

        long productionStarted = all.stream()
                .filter(e -> e.stage == VenFlowStage.PRODUCTION_STARTED)
                .count();

        long jobDone = all.stream()
                .filter(e -> e.stage == VenFlowStage.JOB_DONE)
                .count();

        long delayedItems = all.stream()
                .filter(e -> e.expectedDate != null)
                .filter(e -> e.expectedDate.isBefore(today))
                .filter(e -> e.stage != VenFlowStage.JOB_DONE)
                .count();

        long totalPendingWorkLoading = all.stream()
                .filter(e -> e.stage != VenFlowStage.JOB_DONE)
                .count();

        return new ReportSummaryResponse(
                totalOrders,
                pendingStoreCheck,
                sentToPurchase,
                pendingPoRaise,
                pendingPoApproval,
                pendingMaterialReceiving,
                materialReceivedNotInformed,
                productionNotStarted,
                productionStarted,
                jobDone,
                delayedItems,
                totalPendingWorkLoading);
    }

    /*
     * =========================================================
     * AUDIT
     * =========================================================
     */

    @Transactional(readOnly = true)
    public List<VenFlowAuditLog> auditLogs(UUID entryId) {
        getVisibleOrThrow(entryId);

        return auditRepo.findByEntryIdOrderByChangedAtDesc(entryId);
    }

    /*
     * =========================================================
     * VALIDATION HELPERS
     * =========================================================
     */

    private void requireHeader(VenFlowEntry e) {
        require(e.orderDate, "Order Date must be entered first.");
        requireText(e.pdNo, "PD No. must be entered first.");
        requireText(e.clientName, "Client Name must be entered first.");
        requireText(e.plantCode, "Plant must be entered first.");
    }

    private void requireProductDetails(VenFlowEntry e) {
        requireHeader(e);
        requireText(e.productDescription, "Product Description must be entered first.");
        requireText(e.veneerType, "Veneer Type must be entered first.");
        requireText(e.size, "Size must be entered first.");
    }

    private void requireStoreStatus(VenFlowEntry e) {
        requireProductDetails(e);
        require(e.storeStatus, "Store Status must be entered first.");
    }

    private void requireRequisition(VenFlowEntry e) {
        requireStoreStatus(e);
        requireText(e.requisitionSlipNo, "Requisition Slip No. must be entered first.");
        require(e.requisitionDate, "Requisition Date must be entered first.");
    }

    private void requireOrderedQty(VenFlowEntry e) {
        requireRequisition(e);
        require(e.orderedQty, "Ordered Qty must be entered first.");
        require(e.unit, "Unit must be entered first.");
    }

    private void requireSentToPurchase(VenFlowEntry e) {
        if (e.stage != VenFlowStage.SENT_TO_PURCHASE
                && e.stage != VenFlowStage.PO_RAISED
                && e.stage != VenFlowStage.PO_APPROVED
                && e.stage != VenFlowStage.MATERIAL_RECEIVED
                && e.stage != VenFlowStage.MATERIAL_INFORMED
                && e.stage != VenFlowStage.PRODUCTION_STARTED
                && e.stage != VenFlowStage.JOB_DONE) {
            throw badRequest("Entry must be sent to Purchase first.");
        }
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
            BigDecimal orderedQty,
            BigDecimal receivedQty) {
        if (orderedQty == null) {
            return null;
        }

        BigDecimal received = receivedQty == null
                ? BigDecimal.ZERO
                : receivedQty;

        return orderedQty.subtract(received);
    }

    /*
     * =========================================================
     * ACCESS HELPERS
     * =========================================================
     */

    private Specification<VenFlowEntry> visibleSpec() {
        Set<String> plants = access.allowedPlantCodes();

        boolean allPlants = access.isAdminOrManager()
                && plants.isEmpty();

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
     * AUDIT / ACTOR
     * =========================================================
     */

    private void audit(
            UUID entryId,
            String action,
            Object oldValue,
            Object newValue) {
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

    /*
     * =========================================================
     * EXCEPTION HELPERS
     * =========================================================
     */

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }
}