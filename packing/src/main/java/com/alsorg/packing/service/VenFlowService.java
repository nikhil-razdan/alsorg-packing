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
         * ENGINEERING - CREATE BOM / INDENT
         * =========================================================
         */

        public VenFlowEntry create(CreateRequest req) {
                access.requireEngineering();

                require(req, "Request body is required.");
                requireText(req.plantCode(), "Plant is required.");
                require(req.orderDate(), "Order Date is required.");
                requireText(req.pdNo(), "PD No. is required.");
                requireText(req.drawingNo(), "Drawing No. is required.");
                requireText(req.clientName(), "Client Name is required.");
                requireText(req.materialName(), "Material Name is required.");
                require(req.requiredQty(), "Required Qty is required.");
                require(req.unit(), "Unit is required.");

                if (req.requiredQty().compareTo(BigDecimal.ZERO) <= 0) {
                        throw badRequest("Required Qty must be greater than zero.");
                }

                String plantCode = cleanUpper(req.plantCode());

                access.assertPlantAccess(plantCode);

                VenFlowEntry e = new VenFlowEntry();

                e.plantCode = plantCode;
                e.orderDate = req.orderDate();

                e.pdNo = clean(req.pdNo());
                e.drawingNo = clean(req.drawingNo());
                e.clientName = clean(req.clientName());

                e.materialName = clean(req.materialName());
                e.productDescription = clean(req.materialName());
                e.veneerType = clean(req.veneerType());
                e.thickness = clean(req.thickness());
                e.size = clean(req.size());

                e.requiredQty = req.requiredQty();
                e.orderedQty = req.requiredQty();
                e.unit = req.unit();
                e.balanceQty = req.requiredQty();

                e.bomReference = clean(req.bomReference());
                e.bomAttachmentUrl = clean(req.bomAttachmentUrl());
                e.sampleImageUrl = clean(req.sampleImageUrl());

                e.remarks = clean(req.remarks());

                e.stage = VenFlowStage.INDENT_CREATED;
                e.stockDecision = VenFlowStockDecision.PENDING;
                e.poStatus = VenFlowPoStatus.NOT_RAISED;
                e.qcStatus = VenFlowQcStatus.NOT_REQUIRED;
                e.issueStatus = VenFlowIssueStatus.NOT_RESERVED;
                e.processingStatus = VenFlowProcessingStatus.NOT_STARTED;

                e.raisedBy = actor();
                e.raisedAt = LocalDateTime.now();

                e.createdBy = actor();
                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                saved.id,
                                "INDENT_CREATED",
                                null,
                                "Plant=" + saved.plantCode
                                                + ", PD=" + saved.pdNo
                                                + ", Drawing=" + saved.drawingNo
                                                + ", Client=" + saved.clientName
                                                + ", Material=" + saved.materialName
                                                + ", Qty=" + saved.requiredQty + " " + saved.unit);

                return saved;
        }

        public VenFlowEntry sendToStore(UUID id) {
                access.requireEngineering();

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.INDENT_CREATED) {
                        throw badRequest("Only newly created indent can be sent to Store.");
                }

                String oldValue = String.valueOf(e.stage);

                e.stage = VenFlowStage.SENT_TO_STORE;
                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "SENT_TO_STORE", oldValue, String.valueOf(saved.stage));

                return saved;
        }

        /*
         * =========================================================
         * STORE - STOCK REVIEW
         * =========================================================
         */

        public VenFlowEntry storeReview(UUID id, StoreReviewRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                require(req.stockDecision(), "Stock decision is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.SENT_TO_STORE
                                && e.stage != VenFlowStage.STORE_REVIEWED
                                && e.stage != VenFlowStage.STOCK_AVAILABLE) {
                        throw badRequest("Store can review only after indent is sent to Store.");
                }

                String oldValue = "Decision=" + e.stockDecision
                                + ", Available Qty=" + e.availableQty
                                + ", Stage=" + e.stage;

                e.stockDecision = req.stockDecision();
                e.availableQty = req.availableQty();

                if (req.stockDecision() == VenFlowStockDecision.AVAILABLE
                                || req.stockDecision() == VenFlowStockDecision.PARTIALLY_AVAILABLE) {
                        e.stage = VenFlowStage.STOCK_AVAILABLE;
                } else {
                        e.stage = VenFlowStage.STORE_REVIEWED;
                }

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "STORE_REVIEWED",
                                oldValue,
                                "Decision=" + saved.stockDecision
                                                + ", Available Qty=" + saved.availableQty
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry reserveMaterial(UUID id, ReserveMaterialRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                require(req.reservedQty(), "Reserved Qty is required.");

                if (req.reservedQty().compareTo(BigDecimal.ZERO) <= 0) {
                        throw badRequest("Reserved Qty must be greater than zero.");
                }

                VenFlowEntry e = getVisibleOrThrow(id);

                boolean allowedStage = e.stage == VenFlowStage.STOCK_AVAILABLE
                                || e.stage == VenFlowStage.MATERIAL_ACCEPTED_IN_STORE;

                if (!allowedStage) {
                        throw badRequest(
                                        "Material can be reserved only after stock availability or accepted inventory.");
                }

                String oldValue = "Reserved=" + e.reservedQty
                                + ", Issue Status=" + e.issueStatus
                                + ", Stage=" + e.stage;

                e.reservedQty = req.reservedQty();
                e.issueStatus = VenFlowIssueStatus.RESERVED;
                e.stage = VenFlowStage.MATERIAL_RESERVED;

                e.reservedBy = actor();
                e.reservedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "MATERIAL_RESERVED",
                                oldValue,
                                "Reserved=" + saved.reservedQty
                                                + ", Issue Status=" + saved.issueStatus
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry raisePurchaseRequest(UUID id, PurchaseRequestRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                requireText(req.purchaseRequestNo(), "Purchase Request No. is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.STORE_REVIEWED
                                && e.stage != VenFlowStage.STOCK_AVAILABLE) {
                        throw badRequest("Store review must be done before raising purchase request.");
                }

                if (e.stockDecision != VenFlowStockDecision.NOT_AVAILABLE
                                && e.stockDecision != VenFlowStockDecision.PARTIALLY_AVAILABLE
                                && e.stockDecision != VenFlowStockDecision.HOLD) {
                        throw badRequest(
                                        "Purchase request is allowed only when stock is not available, partial, or on hold.");
                }

                String oldValue = "PR=" + e.purchaseRequestNo
                                + ", Stage=" + e.stage;

                e.purchaseRequestNo = clean(req.purchaseRequestNo());
                e.requisitionSlipNo = clean(req.purchaseRequestNo());
                e.requisitionDate = req.requisitionDate();

                e.purchaseRequestBy = actor();
                e.purchaseRequestAt = LocalDateTime.now();

                e.stage = VenFlowStage.PURCHASE_REQUEST_RAISED;

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "PURCHASE_REQUEST_RAISED",
                                oldValue,
                                "PR=" + saved.purchaseRequestNo
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        /*
         * =========================================================
         * PURCHASE - PO
         * =========================================================
         */

        public VenFlowEntry raisePo(UUID id, PoRequest req) {
                access.requirePurchase();

                require(req, "Request body is required.");
                requireText(req.vendorName(), "Vendor Name is required.");
                requireText(req.poNo(), "PO No. is required.");
                require(req.poDate(), "PO Date is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.PURCHASE_REQUEST_RAISED
                                && e.stage != VenFlowStage.PO_RAISED) {
                        throw badRequest("Purchase request must be raised before PO.");
                }

                String oldValue = "PO=" + e.poNo
                                + ", Vendor=" + e.vendorName
                                + ", Status=" + e.poStatus
                                + ", Stage=" + e.stage;

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
                                                + ", Status=" + saved.poStatus
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry approvePo(UUID id) {
                access.requireManagerApproval();

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.poStatus != VenFlowPoStatus.RAISED) {
                        throw badRequest("PO must be raised before approval.");
                }

                String oldValue = "PO Status=" + e.poStatus;

                e.poStatus = VenFlowPoStatus.APPROVED;

                /*
                 * New flow does not need separate PO_APPROVED stage.
                 * Keep stage as PO_RAISED so Store can receive material.
                 */
                if (e.stage != VenFlowStage.PO_RAISED) {
                        e.stage = VenFlowStage.PO_RAISED;
                }

                e.poApprovedBy = actor();
                e.poApprovedAt = LocalDateTime.now();

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "PO_APPROVED",
                                oldValue,
                                "PO Status=" + saved.poStatus);

                return saved;
        }

        /*
         * =========================================================
         * STORE - RECEIVING / GRN / QC / ACCEPTANCE
         * =========================================================
         */

        public VenFlowEntry materialReceived(UUID id, MaterialReceivedRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                require(req.receivedQty(), "Received Qty is required.");

                if (req.receivedQty().compareTo(BigDecimal.ZERO) < 0) {
                        throw badRequest("Received Qty cannot be negative.");
                }

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.PO_RAISED) {
                        throw badRequest("PO must be raised before material receiving.");
                }

                String oldValue = "Received=" + e.receivedQty
                                + ", Stage=" + e.stage;

                e.receivedQty = req.receivedQty();
                e.actualInHouseDate = req.actualInHouseDate();
                e.balanceQty = calculateBalance(e.requiredQty, e.receivedQty);

                e.stage = VenFlowStage.MATERIAL_RECEIVED_AT_STORE;

                e.materialReceivedBy = actor();
                e.materialReceivedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "MATERIAL_RECEIVED_AT_STORE",
                                oldValue,
                                "Received=" + saved.receivedQty
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry grnEntry(UUID id, GrnRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                requireText(req.grnNo(), "GRN No. is required.");
                require(req.grnDate(), "GRN Date is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.MATERIAL_RECEIVED_AT_STORE) {
                        throw badRequest("Material must be received before GRN entry.");
                }

                String oldValue = "GRN=" + e.grnNo
                                + ", QC=" + e.qcStatus
                                + ", Stage=" + e.stage;

                e.grnNo = clean(req.grnNo());
                e.grnDate = req.grnDate();

                e.grnBy = actor();
                e.grnAt = LocalDateTime.now();

                e.qcStatus = VenFlowQcStatus.PENDING;
                e.stage = VenFlowStage.GRN_DONE;

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "GRN_DONE",
                                oldValue,
                                "GRN=" + saved.grnNo
                                                + ", QC=" + saved.qcStatus
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry qualityCheck(UUID id, QcRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                require(req.qcStatus(), "QC Status is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.GRN_DONE
                                && e.stage != VenFlowStage.QC_PENDING) {
                        throw badRequest("GRN must be done before QC.");
                }

                String oldValue = "QC=" + e.qcStatus
                                + ", Stage=" + e.stage;

                e.qcStatus = req.qcStatus();
                e.qcRemarks = clean(req.qcRemarks());
                e.rejectionReason = clean(req.rejectionReason());

                e.qcCheckedBy = actor();
                e.qcCheckedAt = LocalDateTime.now();

                if (req.qcStatus() == VenFlowQcStatus.OK) {
                        e.stage = VenFlowStage.QC_OK;
                } else if (req.qcStatus() == VenFlowQcStatus.PENDING) {
                        e.stage = VenFlowStage.QC_PENDING;
                } else {
                        e.stage = VenFlowStage.MATERIAL_REJECTED_HOLD_RETURN;
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "QUALITY_CHECK",
                                oldValue,
                                "QC=" + saved.qcStatus
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry acceptInventory(UUID id) {
                access.requireStore();

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.QC_OK) {
                        throw badRequest("QC must be OK before accepting material in Store Inventory.");
                }

                String oldValue = String.valueOf(e.stage);

                e.stage = VenFlowStage.MATERIAL_ACCEPTED_IN_STORE;
                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "MATERIAL_ACCEPTED_IN_STORE", oldValue, String.valueOf(saved.stage));

                return saved;
        }

        public VenFlowEntry informProduction(UUID id) {
                access.requireStore();

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.MATERIAL_RESERVED
                                && e.stage != VenFlowStage.MATERIAL_ACCEPTED_IN_STORE) {
                        throw badRequest(
                                        "Material must be reserved or accepted in inventory before informing Production.");
                }

                String oldValue = String.valueOf(e.stage);

                e.stage = VenFlowStage.PRODUCTION_INFORMED;

                e.materialInformedBy = actor();
                e.materialInformedAt = LocalDateTime.now();

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "PRODUCTION_INFORMED", oldValue, String.valueOf(saved.stage));

                return saved;
        }

        public VenFlowEntry issueMaterial(UUID id, IssueMaterialRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                require(req.issuedQty(), "Issued Qty is required.");
                requireText(req.issuedTo(), "Issued To is required.");

                if (req.issuedQty().compareTo(BigDecimal.ZERO) <= 0) {
                        throw badRequest("Issued Qty must be greater than zero.");
                }

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.PRODUCTION_DETAILS_ADDED
                                && e.stage != VenFlowStage.MATERIAL_RESERVED
                                && e.stage != VenFlowStage.PRODUCTION_INFORMED) {
                        throw badRequest(
                                        "Material can be issued only after reservation/inventory acceptance and production information.");
                }

                String oldValue = "Issued=" + e.issuedQty
                                + ", Status=" + e.issueStatus
                                + ", Stage=" + e.stage;

                e.issuedQty = req.issuedQty();
                e.issuedTo = clean(req.issuedTo());

                e.issueStatus = VenFlowIssueStatus.ISSUED;
                e.stage = VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION;

                e.issuedBy = actor();
                e.issuedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "MATERIAL_ISSUED_TO_PRODUCTION",
                                oldValue,
                                "Issued=" + saved.issuedQty
                                                + ", To=" + saved.issuedTo
                                                + ", Status=" + saved.issueStatus
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        /*
         * =========================================================
         * PROCESSING / PRODUCTION
         * =========================================================
         */

        public VenFlowEntry productionDetails(UUID id, ProductionDetailsRequest req) {
                access.requireProcessing();

                require(req, "Request body is required.");
                requireText(req.productionDetails(), "Production details are required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.PRODUCTION_INFORMED
                                && e.stage != VenFlowStage.MATERIAL_RESERVED) {
                        throw badRequest("Production details can be added only after Store informs Production.");
                }

                String oldValue = "Production Details=" + e.productionDetails
                                + ", Supervisor=" + e.supervisorName
                                + ", Stage=" + e.stage;

                e.productionDetails = clean(req.productionDetails());
                e.supervisorName = clean(req.supervisorName());

                e.stage = VenFlowStage.PRODUCTION_DETAILS_ADDED;

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "PRODUCTION_DETAILS_ADDED",
                                oldValue,
                                "Production Details=" + saved.productionDetails
                                                + ", Supervisor=" + saved.supervisorName
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry startProcessing(UUID id) {
                access.requireProcessing();

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.MATERIAL_ISSUED_TO_PRODUCTION) {
                        throw badRequest("Material must be issued to Production/Harender before processing starts.");
                }

                String oldValue = "Processing=" + e.processingStatus
                                + ", Stage=" + e.stage;

                e.processingStatus = VenFlowProcessingStatus.STARTED;
                e.stage = VenFlowStage.PROCESSING_STARTED;

                e.processingStartedBy = actor();
                e.processingStartedAt = LocalDateTime.now();

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "PROCESSING_STARTED",
                                oldValue,
                                "Processing=" + saved.processingStatus
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        public VenFlowEntry completeProcess(UUID id, ProcessingRequest req) {
                access.requireProcessing();

                require(req, "Request body is required.");

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.PROCESSING_STARTED) {
                        throw badRequest("Processing must be started before completion update.");
                }

                String oldValue = "Used=" + e.usedQty
                                + ", Wastage=" + e.wastageQty
                                + ", Balance=" + e.balanceQty
                                + ", Processing=" + e.processingStatus
                                + ", Stage=" + e.stage;

                e.usedQty = req.usedQty();
                e.wastageQty = req.wastageQty();
                e.balanceQty = req.balanceQty();
                e.outputImageUrl = clean(req.outputImageUrl());

                e.processingStatus = VenFlowProcessingStatus.COMPLETED;
                e.stage = VenFlowStage.PROCESS_COMPLETED;

                e.processCompletedBy = actor();
                e.processCompletedAt = LocalDateTime.now();

                if (hasText(req.remarks())) {
                        e.remarks = clean(req.remarks());
                }

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "PROCESS_COMPLETED",
                                oldValue,
                                "Used=" + saved.usedQty
                                                + ", Wastage=" + saved.wastageQty
                                                + ", Balance=" + saved.balanceQty
                                                + ", Processing=" + saved.processingStatus
                                                + ", Stage=" + saved.stage);

                return saved;
        }

        /*
         * =========================================================
         * SUPERVISOR CLOSURE
         * =========================================================
         */

        public VenFlowEntry supervisorInformed(UUID id) {
                access.requireProcessingOrSupervisor();

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.PROCESS_COMPLETED) {
                        throw badRequest("Process must be completed before informing supervisor.");
                }

                String oldValue = String.valueOf(e.stage);

                e.stage = VenFlowStage.SUPERVISOR_INFORMED;

                e.supervisorInformedBy = actor();
                e.supervisorInformedAt = LocalDateTime.now();

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(id, "SUPERVISOR_INFORMED", oldValue, String.valueOf(saved.stage));

                return saved;
        }

        public VenFlowEntry readyForNextStage(UUID id) {
                access.requireSupervisor();

                VenFlowEntry e = getVisibleOrThrow(id);

                if (e.stage != VenFlowStage.SUPERVISOR_INFORMED) {
                        throw badRequest("Supervisor must be informed before marking ready for next stage.");
                }

                String oldValue = "Processing=" + e.processingStatus
                                + ", Stage=" + e.stage;

                e.processingStatus = VenFlowProcessingStatus.READY_FOR_NEXT_STAGE;
                e.stage = VenFlowStage.READY_FOR_NEXT_STAGE;

                e.nextStageReadyBy = actor();
                e.nextStageReadyAt = LocalDateTime.now();

                e.updatedBy = actor();

                VenFlowEntry saved = entryRepo.save(e);

                audit(
                                id,
                                "READY_FOR_NEXT_STAGE",
                                oldValue,
                                "Processing=" + saved.processingStatus
                                                + ", Stage=" + saved.stage);

                return saved;
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
                                                VenFlowStage.PO_RAISED,
                                                VenFlowStage.MATERIAL_REJECTED_HOLD_RETURN)));

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
                                .filter(e -> e.stage == VenFlowStage.PO_RAISED)
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
                                .filter(e -> e.stage == VenFlowStage.PO_RAISED)
                                .filter(e -> e.poStatus == VenFlowPoStatus.RAISED)
                                .count();

                long pendingMaterialReceiving = all.stream()
                                .filter(e -> e.stage == VenFlowStage.PO_RAISED)
                                .count();

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

        public VenFlowEntry updateStoreStatus(UUID id, StoreStatusRequest req) {
                access.requireStore();

                require(req, "Request body is required.");
                require(req.storeStatus(), "Store Status is required.");

                VenFlowStockDecision decision = switch (req.storeStatus()) {
                        case AVAILABLE_IN_STORE -> VenFlowStockDecision.AVAILABLE;
                        case PARTIALLY_AVAILABLE -> VenFlowStockDecision.PARTIALLY_AVAILABLE;
                        case NOT_AVAILABLE -> VenFlowStockDecision.NOT_AVAILABLE;
                        case HOLD -> VenFlowStockDecision.HOLD;
                        case PENDING -> VenFlowStockDecision.PENDING;
                };

                VenFlowEntry e = getVisibleOrThrow(id);
                e.storeStatus = req.storeStatus();
                entryRepo.save(e);

                return storeReview(
                                id,
                                new StoreReviewRequest(
                                                decision,
                                                e.availableQty,
                                                "Updated from legacy store-status endpoint."));
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

        public VenFlowEntry startProduction(UUID id, ProductionActionRequest req) {
                return startProcessing(id);
        }

        public VenFlowEntry jobDone(UUID id, ProductionActionRequest req) {
                return completeProcess(
                                id,
                                new ProcessingRequest(
                                                null,
                                                null,
                                                null,
                                                null,
                                                req == null ? "Completed from legacy job-done endpoint."
                                                                : req.remarks()));
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

        private BigDecimal calculateBalance(BigDecimal requiredQty, BigDecimal receivedQty) {
                if (requiredQty == null) {
                        return null;
                }

                BigDecimal received = receivedQty == null
                                ? BigDecimal.ZERO
                                : receivedQty;

                return requiredQty.subtract(received);
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
}