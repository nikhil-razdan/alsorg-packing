package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.PurchaseOrderResponse;

import com.alsorg.packing.domain.matflow.MatFlowGoodsReceipt;
import com.alsorg.packing.domain.matflow.MatFlowGoodsReceiptLine;
import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.GoodsReceiptStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLine;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowQcInspection;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowVendor;

import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
import com.alsorg.packing.repository.matflow.MatFlowQcInspectionRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.alsorg.packing.repository.matflow.MatFlowVendorRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowProcurementService {

        private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
        private final MatFlowPurchaseOrderLineRepository purchaseOrderLineRepository;
        private final MatFlowIndentRepository indentRepository;
        private final MatFlowIndentLineRepository indentLineRepository;
        private final MatFlowVendorRepository vendorRepository;
        private final MatFlowLocationRepository locationRepository;
        private final MatFlowGoodsReceiptRepository receiptRepository;
        private final MatFlowGoodsReceiptLineRepository receiptLineRepository;
        private final MatFlowQcInspectionRepository qcRepository;
        private final MatFlowStockBalanceRepository stockRepository;
        private final MatFlowStockLedgerRepository ledgerRepository;
        private final MatFlowAccessService accessService;
        private final MatFlowAuditService auditService;
        private final MatFlowRequisitionService requisitionService;

        public MatFlowProcurementService(
                        MatFlowPurchaseOrderRepository purchaseOrderRepository,
                        MatFlowPurchaseOrderLineRepository purchaseOrderLineRepository,
                        MatFlowIndentRepository indentRepository,
                        MatFlowIndentLineRepository indentLineRepository,
                        MatFlowVendorRepository vendorRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowGoodsReceiptRepository receiptRepository,
                        MatFlowGoodsReceiptLineRepository receiptLineRepository,
                        MatFlowQcInspectionRepository qcRepository,
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService,
                        MatFlowRequisitionService requisitionService) {
                this.purchaseOrderRepository = purchaseOrderRepository;

                this.purchaseOrderLineRepository = purchaseOrderLineRepository;

                this.indentRepository = indentRepository;

                this.indentLineRepository = indentLineRepository;

                this.vendorRepository = vendorRepository;

                this.locationRepository = locationRepository;

                this.receiptRepository = receiptRepository;

                this.receiptLineRepository = receiptLineRepository;

                this.qcRepository = qcRepository;

                this.stockRepository = stockRepository;

                this.ledgerRepository = ledgerRepository;

                this.accessService = accessService;

                this.auditService = auditService;
                this.requisitionService = requisitionService;
        }

        @Transactional(readOnly = true)
        public List<PurchaseOrderResponse> listPurchaseOrders() {
                accessService.requireIndentRead();

                return purchaseOrderRepository
                                .findAllByOrderByUpdatedAtDesc()
                                .stream()
                                .map(this::hydratePurchaseOrder)
                                .filter(order -> order != null &&
                                                order.deliveryLocation != null &&
                                                accessService.canAccessPlant(
                                                                order.deliveryLocation.getPlantCode()))
                                .map(this::toPurchaseOrderResponse)
                                .toList();
        }

        @Transactional
        public PurchaseOrderResponse createPurchaseOrder(
                        PurchaseOrderRequest request) {
                accessService.requirePurchaseOrderWrite();

                validatePurchaseRequest(request);

                if (purchaseOrderRepository
                                .existsByPoNumberIgnoreCase(
                                                request.poNumber())) {
                        throw conflict(
                                        "Purchase order number already exists");
                }

                MatFlowIndent indent = indentRepository
                                .findById(request.indentId())
                                .orElseThrow(() -> notFound(
                                                "Indent not found"));

                boolean purchaseReadyIndent = indent.status == IndentStatus.SUBMITTED_TO_PURCHASE ||
                                indent.status == IndentStatus.PURCHASE_IN_PROGRESS ||
                                indent.status == IndentStatus.PO_CREATED ||
                                indent.status == IndentStatus.PARTIALLY_RECEIVED;

                if (!purchaseReadyIndent) {
                        throw conflict(
                                        "Purchase Orders can be created only after Store submits the shortage indent to Purchase. Current indent status: "
                                                        +
                                                        indent.status);
                }

                MatFlowVendor vendor = vendorRepository
                                .findById(request.vendorId())
                                .orElseThrow(() -> notFound(
                                                "Vendor not found"));

                if (!vendor.active) {
                        throw badRequest(
                                        "Inactive vendor cannot be selected");
                }

                MatFlowLocation location = requireLocation(
                                request.deliveryLocationId());

                if (!location.getId()
                                .equals(
                                                indent.deliverToLocation
                                                                .getId())) {
                        throw conflict(
                                        "PO delivery location must match the indent delivery location");
                }

                String actor = accessService.actor();

                MatFlowPurchaseOrder order = new MatFlowPurchaseOrder();

                order.poNumber = request.poNumber()
                                .trim()
                                .toUpperCase();

                order.poDate = request.poDate();

                order.vendor = vendor;
                order.indent = indent;
                order.deliveryLocation = location;
                order.status = PurchaseOrderStatus.DRAFT;
                order.remarks = clean(request.remarks());

                order.setCreatedBy(actor);
                order.setUpdatedBy(actor);

                order = purchaseOrderRepository.save(order);

                Set<UUID> uniqueIndentLines = new HashSet<>();

                for (PurchaseOrderLineRequest lineRequest : request.lines()) {
                        if (!uniqueIndentLines.add(
                                        lineRequest.indentLineId())) {
                                throw badRequest(
                                                "An indent line was selected more than once");
                        }

                        MatFlowIndentLine indentLine = hydrateIndentLine(
                                        indentLineRepository
                                                        .findByIdAndIndent_Id(
                                                                        lineRequest.indentLineId(),
                                                                        indent.getId())
                                                        .orElseThrow(() -> badRequest(
                                                                        "Indent line does not belong to the selected indent")));

                        BigDecimal orderedQty = positive(
                                        lineRequest.orderedQty(),
                                        "Ordered quantity");

                        BigDecimal requiredQty = requireIndentRequiredQuantity(
                                        indentLine);

                        BigDecimal committed = committedOrderedQuantity(
                                        indentLine.getId(),
                                        null);

                        BigDecimal remaining = requiredQty
                                        .subtract(committed)
                                        .max(BigDecimal.ZERO)
                                        .setScale(3, RoundingMode.HALF_UP);

                        if (orderedQty.compareTo(
                                        remaining) > 0) {
                                throw conflict(
                                                "Ordered quantity exceeds the outstanding indent quantity for " +
                                                                materialCode(indentLine.material));
                        }

                        MatFlowPurchaseOrderLine line = new MatFlowPurchaseOrderLine();

                        line.purchaseOrder = order;
                        line.indentLine = indentLine;
                        line.material = indentLine.material;
                        line.orderedQty = orderedQty;
                        line.receivedQty = BigDecimal.ZERO;
                        line.uom = indentLine.uom;
                        line.remarks = clean(lineRequest.remarks());

                        line.setCreatedBy(actor);
                        line.setUpdatedBy(actor);

                        purchaseOrderLineRepository.save(
                                        line);
                }

                auditService.record(
                                "PURCHASE_ORDER",
                                order.getId(),
                                "PURCHASE_ORDER_CREATED",
                                order.deliveryLocation == null ? null : order.deliveryLocation.getPlantCode(),
                                order.indent == null || order.indent.projectDrawing == null
                                                ? null
                                                : order.indent.projectDrawing.getProjectCode(),
                                order.indent == null || order.indent.projectDrawing == null
                                                ? null
                                                : order.indent.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "poNumber", order.poNumber,
                                                "vendor", order.vendor == null ? null : order.vendor.vendorName,
                                                "indentNumber", order.indent == null ? null : order.indent.indentNumber,
                                                "lineCount", request.lines().size(),
                                                "status", order.status));

                return toPurchaseOrderResponse(order);
        }

        @Transactional
        public PurchaseOrderResponse approvePurchaseOrder(
                        UUID id,
                        PurchaseOrderActionRequest request) {
                accessService.requirePurchaseOrderApproval();

                MatFlowPurchaseOrder order = requirePurchaseOrder(id);

                if (order.status != PurchaseOrderStatus.DRAFT) {
                        throw conflict(
                                        "Only a draft purchase order can be approved and placed");
                }

                assertVersion(
                                request == null
                                                ? null
                                                : request.rowVersion(),
                                order.getRowVersion(),
                                "Purchase order");

                List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepository
                                .findByPurchaseOrder_IdOrderByCreatedAtAsc(
                                                order.getId())
                                .stream()
                                .map(this::hydratePurchaseOrderLine)
                                .toList();

                if (lines.isEmpty()) {
                        throw badRequest(
                                        "Purchase order requires at least one line");
                }

                for (MatFlowPurchaseOrderLine line : lines) {
                        MatFlowIndentLine indentLine = requirePurchaseOrderIndentLine(
                                        line);

                        BigDecimal orderedQty = positive(
                                        line.orderedQty,
                                        "PO line ordered quantity");

                        BigDecimal requiredQty = requireIndentRequiredQuantity(
                                        indentLine);

                        BigDecimal otherCommitted = committedOrderedQuantity(
                                        indentLine.getId(),
                                        order.getId());

                        BigDecimal available = requiredQty
                                        .subtract(otherCommitted)
                                        .max(BigDecimal.ZERO)
                                        .setScale(3, RoundingMode.HALF_UP);

                        if (orderedQty.compareTo(
                                        available) > 0) {
                                throw conflict(
                                                "Outstanding indent quantity changed for material " +
                                                                materialCode(line.material) +
                                                                ". Required=" + requiredQty +
                                                                ", already committed=" + otherCommitted +
                                                                ", this PO=" + orderedQty +
                                                                ". Refresh Purchase and verify the shortage before approval.");
                        }
                }

                String actor = accessService.actor();

                order.status = PurchaseOrderStatus.PLACED;
                order.approvedBy = actor;
                order.approvedAt = LocalDateTime.now();
                order.approvalRemarks = request == null ? null : clean(request.remarks());

                if (request != null &&
                                clean(request.remarks()) != null) {
                        order.remarks = clean(request.remarks());
                }

                order.setUpdatedBy(actor);

                order = purchaseOrderRepository.save(order);

                for (MatFlowPurchaseOrderLine line : lines) {
                        MatFlowIndentLine indentLine = requirePurchaseOrderIndentLine(
                                        line);

                        /*
                         * If this row came from an older record where requiredQty was
                         * genuinely null (rather than only hidden behind a Hibernate
                         * proxy), requireIndentRequiredQuantity() repairs it from the
                         * linked requisition shortage before we persist the approved
                         * commitment.
                         */
                        indentLine.requiredQty = requireIndentRequiredQuantity(
                                        indentLine);

                        indentLine.orderedQty = committedOrderedQuantity(
                                        indentLine.getId(),
                                        null);

                        indentLine.setUpdatedBy(actor);

                        indentLineRepository.save(
                                        indentLine);
                }

                refreshIndentOrderingStatus(
                                order.indent,
                                actor);

                if (order.indent != null && order.indent.requisition != null) {
                        requisitionService.refreshState(order.indent.requisition.getId(), actor);
                }

                auditService.record(
                                "PURCHASE_ORDER",
                                order.getId(),
                                "PURCHASE_ORDER_APPROVED",
                                order.deliveryLocation == null ? null : order.deliveryLocation.getPlantCode(),
                                order.indent == null || order.indent.projectDrawing == null
                                                ? null
                                                : order.indent.projectDrawing.getProjectCode(),
                                order.indent == null || order.indent.projectDrawing == null
                                                ? null
                                                : order.indent.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "poNumber", order.poNumber,
                                                "vendor", order.vendor == null ? null : order.vendor.vendorName,
                                                "status", order.status,
                                                "approvedBy", actor,
                                                "approvedAt", order.approvedAt,
                                                "approvalRemarks", order.approvalRemarks));

                return toPurchaseOrderResponse(order);
        }

        /**
         * Temporary compatibility alias for the current controller. The next
         * controller pass should expose this as an approval action rather than a
         * Purchase-user "place" action.
         */
        @Deprecated
        @Transactional
        public PurchaseOrderResponse placePurchaseOrder(
                        UUID id,
                        PurchaseOrderActionRequest request) {
                return approvePurchaseOrder(id, request);
        }

        @Transactional(readOnly = true)
        public List<GoodsReceiptResponse> listGoodsReceipts() {
                accessService.requireRead();

                return receiptRepository
                                .findAllByOrderByReceivedAtDesc()
                                .stream()
                                .filter(receipt -> accessService.canAccessPlant(
                                                receipt.receiptLocation.getPlantCode()))
                                .map(this::toGoodsReceiptResponse)
                                .toList();
        }

        @Transactional
        public GoodsReceiptResponse createGoodsReceipt(
                        GoodsReceiptRequest request) {
                accessService.requireGoodsReceiptWrite();

                validateReceiptRequest(request);

                MatFlowPurchaseOrder order = requirePurchaseOrder(
                                request.purchaseOrderId());

                if (order.status != PurchaseOrderStatus.PLACED &&
                                order.status != PurchaseOrderStatus.PARTIALLY_RECEIVED) {
                        throw conflict(
                                        "Purchase order is not open for receipt");
                }

                MatFlowLocation receiptLocation = requireLocation(
                                request.receiptLocationId());

                if (!receiptLocation.getId()
                                .equals(
                                                order.deliveryLocation
                                                                .getId())) {
                        throw conflict(
                                        "GRN location must match the PO delivery location");
                }

                if (!receiptLocation.isSupportsStock()) {
                        throw badRequest(
                                        "GRN location does not support stock");
                }

                String actor = accessService.actor();

                MatFlowGoodsReceipt receipt = new MatFlowGoodsReceipt();

                receipt.grnNumber = generateNumber("GRN");

                receipt.purchaseOrder = order;
                receipt.receiptLocation = receiptLocation;

                receipt.vendorChallanNo = clean(request.vendorChallanNo());

                receipt.vendorInvoiceNo = clean(request.vendorInvoiceNo());

                receipt.status = GoodsReceiptStatus.QC_PENDING;

                receipt.receivedBy = actor;
                receipt.receivedAt = LocalDateTime.now();

                receipt.remarks = clean(request.remarks());

                receipt.setCreatedBy(actor);
                receipt.setUpdatedBy(actor);

                receipt = receiptRepository.save(receipt);

                Set<UUID> uniquePoLines = new HashSet<>();

                for (GoodsReceiptLineRequest lineRequest : request.lines()) {
                        if (!uniquePoLines.add(
                                        lineRequest.purchaseOrderLineId())) {
                                throw badRequest(
                                                "A PO line was selected more than once");
                        }

                        MatFlowPurchaseOrderLine poLine = purchaseOrderLineRepository
                                        .findByIdAndPurchaseOrder_Id(
                                                        lineRequest.purchaseOrderLineId(),
                                                        order.getId())
                                        .orElseThrow(() -> badRequest(
                                                        "PO line does not belong to the selected purchase order"));

                        BigDecimal receivedQty = positive(
                                        lineRequest.receivedQty(),
                                        "Received quantity");

                        BigDecimal outstanding = poLine.orderedQty
                                        .subtract(
                                                        poLine.receivedQty);

                        if (receivedQty.compareTo(
                                        outstanding) > 0) {
                                throw conflict(
                                                "Received quantity exceeds outstanding PO quantity for " +
                                                                poLine.material
                                                                                .getMaterialCode());
                        }

                        MatFlowGoodsReceiptLine receiptLine = new MatFlowGoodsReceiptLine();

                        receiptLine.goodsReceipt = receipt;
                        receiptLine.purchaseOrderLine = poLine;
                        receiptLine.material = poLine.material;
                        receiptLine.receivedQty = receivedQty;
                        receiptLine.acceptedQty = BigDecimal.ZERO;
                        receiptLine.rejectedQty = BigDecimal.ZERO;
                        receiptLine.returnedQty = BigDecimal.ZERO;
                        receiptLine.uom = poLine.uom;
                        receiptLine.batchNo = clean(lineRequest.batchNo());

                        receiptLine.setCreatedBy(actor);
                        receiptLine.setUpdatedBy(actor);

                        receiptLine = receiptLineRepository.save(
                                        receiptLine);

                        poLine.receivedQty = scale(
                                        poLine.receivedQty
                                                        .add(receivedQty));

                        poLine.setUpdatedBy(actor);

                        purchaseOrderLineRepository.save(
                                        poLine);

                        /*
                         * PO-line receivedQty is physical GRN receipt. Do NOT mark
                         * the shortage indent as fulfilled here. The indent's
                         * receivedQty represents QC-accepted usable quantity and
                         * is advanced only by MatFlowQcService. This is what keeps
                         * rejected vendor material open for replacement purchase.
                         */

                        MatFlowStockBalance balance = lockOrCreateBalance(
                                        poLine.material,
                                        receiptLocation,
                                        actor);

                        balance.onHandQty = scale(
                                        balance.onHandQty
                                                        .add(receivedQty));

                        balance.blockedQty = scale(
                                        balance.blockedQty
                                                        .add(receivedQty));

                        balance.setUpdatedBy(actor);

                        balance = stockRepository.save(balance);

                        saveLedger(
                                        balance,
                                        MovementType.RECEIPT,

                                        receivedQty,
                                        BigDecimal.ZERO,
                                        receivedQty,
                                        BigDecimal.ZERO,

                                        "MATFLOW_GRN",
                                        receipt.getId(),
                                        receipt.grnNumber,
                                        receiptLine.batchNo,
                                        "Vendor material received and blocked for QC",
                                        actor);

                        MatFlowQcInspection inspection = new MatFlowQcInspection();

                        inspection.inspectionNumber = generateNumber("MFQ");

                        inspection.sourceType = QcSourceType.GOODS_RECEIPT;

                        inspection.sourceId = receipt.getId();

                        inspection.sourceLineId = receiptLine.getId();

                        inspection.material = receiptLine.material;

                        inspection.location = receiptLocation;

                        inspection.inspectionQty = receivedQty;

                        inspection.acceptedQty = BigDecimal.ZERO;

                        inspection.rejectedQty = BigDecimal.ZERO;

                        inspection.status = QcInspectionStatus.PENDING;

                        inspection.setCreatedBy(actor);
                        inspection.setUpdatedBy(actor);

                        qcRepository.save(inspection);
                }

                refreshPurchaseOrderReceiptStatus(
                                order,
                                actor);

                if (order.indent != null && order.indent.requisition != null) {
                        requisitionService.refreshState(order.indent.requisition.getId(), actor);
                }

                auditService.record(
                                "GOODS_RECEIPT",
                                receipt.getId(),
                                "GRN_POSTED",
                                receipt.receiptLocation.getPlantCode(),
                                order.indent.projectDrawing
                                                .getProjectCode(),
                                order.indent.projectDrawing
                                                .getDrawingNo(),
                                auditService.details(
                                                "grnNumber",
                                                receipt.grnNumber,
                                                "poNumber",
                                                order.poNumber,
                                                "vendor",
                                                order.vendor.vendorName,
                                                "lineCount",
                                                request.lines().size(),
                                                "status",
                                                receipt.status));

                return toGoodsReceiptResponse(receipt);
        }

        private BigDecimal committedOrderedQuantity(
                        UUID indentLineId,
                        UUID excludedOrderId) {
                if (indentLineId == null) {
                        return BigDecimal.ZERO.setScale(
                                        3,
                                        RoundingMode.HALF_UP);
                }

                return purchaseOrderLineRepository
                                .findByIndentLine_Id(
                                                indentLineId)
                                .stream()
                                .map(this::hydratePurchaseOrderLine)
                                .filter(line -> line != null &&
                                                line.purchaseOrder != null)
                                .filter(line -> excludedOrderId == null ||
                                                !line.purchaseOrder
                                                                .getId()
                                                                .equals(excludedOrderId))
                                .filter(line -> line.purchaseOrder.status != PurchaseOrderStatus.DRAFT &&
                                                line.purchaseOrder.status != PurchaseOrderStatus.CANCELLED)
                                .map(line -> {
                                        BigDecimal rejected = receiptLineRepository
                                                        .findByPurchaseOrderLine_IdOrderByCreatedAtAsc(line.getId())
                                                        .stream()
                                                        .map(receiptLine -> scale(receiptLine.rejectedQty))
                                                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                                        return scale(line.orderedQty)
                                                        .subtract(rejected)
                                                        .max(BigDecimal.ZERO)
                                                        .setScale(3, RoundingMode.HALF_UP);
                                })
                                .reduce(
                                                BigDecimal.ZERO.setScale(
                                                                3,
                                                                RoundingMode.HALF_UP),
                                                BigDecimal::add)
                                .setScale(
                                                3,
                                                RoundingMode.HALF_UP);
        }

        private void refreshIndentOrderingStatus(
                        MatFlowIndent rawIndent,
                        String actor) {
                MatFlowIndent indent = hydrateIndent(
                                rawIndent);

                if (indent == null ||
                                indent.getId() == null) {
                        throw conflict(
                                        "Purchase Order is not linked to a valid material indent");
                }

                List<MatFlowIndentLine> lines = indentLineRepository
                                .findByIndent_IdOrderByCreatedAtAsc(
                                                indent.getId())
                                .stream()
                                .map(this::hydrateIndentLine)
                                .toList();

                boolean allOrdered = !lines.isEmpty() &&
                                lines.stream()
                                                .allMatch(line -> scale(line.orderedQty)
                                                                .compareTo(
                                                                                requireIndentRequiredQuantity(
                                                                                                line)) >= 0);

                boolean anyOrdered = lines.stream()
                                .anyMatch(line -> scale(line.orderedQty)
                                                .compareTo(
                                                                BigDecimal.ZERO) > 0);

                indent.status = allOrdered
                                ? IndentStatus.PURCHASE_IN_PROGRESS
                                : anyOrdered
                                                ? IndentStatus.SUBMITTED_TO_PURCHASE
                                                : IndentStatus.AUTO_CREATED;

                indent.setUpdatedBy(actor);

                indentRepository.save(indent);
        }

        private void refreshPurchaseOrderReceiptStatus(
                        MatFlowPurchaseOrder order,
                        String actor) {
                List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepository
                                .findByPurchaseOrder_IdOrderByCreatedAtAsc(
                                                order.getId());

                boolean fullyReceived = !lines.isEmpty() &&
                                lines.stream()
                                                .allMatch(line -> line.receivedQty
                                                                .compareTo(
                                                                                line.orderedQty) >= 0);

                order.status = fullyReceived
                                ? PurchaseOrderStatus.RECEIVED
                                : PurchaseOrderStatus.PARTIALLY_RECEIVED;

                order.setUpdatedBy(actor);

                purchaseOrderRepository.save(order);
        }

        private MatFlowStockBalance lockOrCreateBalance(
                        com.alsorg.packing.domain.matflow.MatFlowMaterial material,
                        MatFlowLocation location,
                        String actor) {
                MatFlowStockBalance balance = stockRepository
                                .lockBalance(
                                                material.getId(),
                                                location.getId())
                                .orElse(null);

                if (balance != null) {
                        return balance;
                }

                MatFlowStockBalance created = new MatFlowStockBalance();

                created.material = material;
                created.location = location;
                created.onHandQty = BigDecimal.ZERO;
                created.reservedQty = BigDecimal.ZERO;
                created.blockedQty = BigDecimal.ZERO;
                created.inTransitQty = BigDecimal.ZERO;

                created.setCreatedBy(actor);
                created.setUpdatedBy(actor);

                return stockRepository.saveAndFlush(
                                created);
        }

        private MatFlowPurchaseOrder requirePurchaseOrder(
                        UUID id) {
                MatFlowPurchaseOrder order = hydratePurchaseOrder(
                                purchaseOrderRepository
                                                .findById(id)
                                                .orElseThrow(() -> notFound(
                                                                "Purchase order not found")));

                if (order.deliveryLocation == null) {
                        throw conflict(
                                        "Purchase order delivery location is missing");
                }

                accessService.requirePlantAccess(
                                order.deliveryLocation.getPlantCode());

                return order;
        }

        private MatFlowLocation requireLocation(
                        UUID id) {
                MatFlowLocation location = locationRepository
                                .findById(id)
                                .orElseThrow(() -> notFound(
                                                "Location not found"));

                accessService.requirePlantAccess(
                                location.getPlantCode());

                if (!location.isActive()) {
                        throw badRequest(
                                        "Inactive location cannot be selected");
                }

                return location;
        }

        private void validatePurchaseRequest(
                        PurchaseOrderRequest request) {
                if (request == null) {
                        throw badRequest(
                                        "Purchase order request is required");
                }

                required(
                                request.poNumber(),
                                "PO number");

                if (request.poDate() == null) {
                        throw badRequest(
                                        "PO date is required");
                }

                if (request.vendorId() == null ||
                                request.indentId() == null ||
                                request.deliveryLocationId() == null) {
                        throw badRequest(
                                        "Vendor, indent and delivery location are required");
                }

                if (request.lines() == null ||
                                request.lines().isEmpty()) {
                        throw badRequest(
                                        "At least one PO line is required");
                }
        }

        private void validateReceiptRequest(
                        GoodsReceiptRequest request) {
                if (request == null ||
                                request.purchaseOrderId() == null ||
                                request.receiptLocationId() == null) {
                        throw badRequest(
                                        "Purchase order and receipt location are required");
                }

                if (request.lines() == null ||
                                request.lines().isEmpty()) {
                        throw badRequest(
                                        "At least one GRN line is required");
                }
        }

        private PurchaseOrderResponse toPurchaseOrderResponse(
                        MatFlowPurchaseOrder rawOrder) {
                MatFlowPurchaseOrder order = hydratePurchaseOrder(
                                rawOrder);

                if (order == null ||
                                order.vendor == null ||
                                order.indent == null ||
                                order.deliveryLocation == null) {
                        throw conflict(
                                        "Purchase order header is incomplete");
                }

                List<PurchaseOrderLineResponse> lines = purchaseOrderLineRepository
                                .findByPurchaseOrder_IdOrderByCreatedAtAsc(
                                                order.getId())
                                .stream()
                                .map(this::hydratePurchaseOrderLine)
                                .map(line -> {
                                        MatFlowIndentLine indentLine = requirePurchaseOrderIndentLine(
                                                        line);

                                        if (line.material == null) {
                                                throw conflict(
                                                                "Purchase order line " +
                                                                                line.getId() +
                                                                                " has no material");
                                        }

                                        return new PurchaseOrderLineResponse(
                                                        line.getId(),
                                                        indentLine.getId(),
                                                        line.material.getId(),
                                                        line.material.getMaterialCode(),
                                                        line.material.getMaterialName(),
                                                        scale(line.orderedQty),
                                                        scale(line.receivedQty),
                                                        line.uom,
                                                        line.getRowVersion());
                                })
                                .toList();

                return new PurchaseOrderResponse(
                                order.getId(),
                                order.poNumber,
                                order.poDate,
                                order.vendor.getId(),
                                order.vendor.vendorCode,
                                order.vendor.vendorName,
                                order.indent.getId(),
                                order.indent.indentNumber,
                                order.deliveryLocation.getId(),
                                order.deliveryLocation.getLocationCode(),
                                order.deliveryLocation.getPlantCode(),
                                order.status,
                                order.approvedBy,
                                order.approvedAt,
                                order.approvalRemarks,
                                order.remarks,
                                order.getRowVersion(),
                                lines);
        }

        private GoodsReceiptResponse toGoodsReceiptResponse(
                        MatFlowGoodsReceipt receipt) {
                List<GoodsReceiptLineResponse> lines = receiptLineRepository
                                .findByGoodsReceipt_IdOrderByCreatedAtAsc(
                                                receipt.getId())
                                .stream()
                                .map(line -> new GoodsReceiptLineResponse(
                                                line.getId(),
                                                line.purchaseOrderLine
                                                                .getId(),
                                                line.material
                                                                .getId(),
                                                line.material
                                                                .getMaterialCode(),
                                                line.material
                                                                .getMaterialName(),
                                                line.receivedQty,
                                                line.acceptedQty,
                                                line.rejectedQty,
                                                line.returnedQty,
                                                line.uom,
                                                line.batchNo,
                                                line.getRowVersion()))
                                .toList();

                return new GoodsReceiptResponse(
                                receipt.getId(),
                                receipt.grnNumber,
                                receipt.purchaseOrder.getId(),
                                receipt.purchaseOrder.poNumber,
                                receipt.receiptLocation.getId(),
                                receipt.receiptLocation.getLocationCode(),
                                receipt.receiptLocation.getPlantCode(),
                                receipt.vendorChallanNo,
                                receipt.vendorInvoiceNo,
                                receipt.status,
                                receipt.receivedBy,
                                receipt.receivedAt,
                                receipt.remarks,
                                receipt.getRowVersion(),
                                lines);
        }

        private void saveLedger(
                        MatFlowStockBalance balance,
                        MovementType type,
                        BigDecimal quantityChange,
                        BigDecimal reservedChange,
                        BigDecimal blockedChange,
                        BigDecimal transitChange,
                        String referenceType,
                        UUID referenceId,
                        String referenceNumber,
                        String batchNo,
                        String remarks,
                        String actor) {
                MatFlowStockLedger ledger = new MatFlowStockLedger();

                ledger.material = balance.material;
                ledger.location = balance.location;
                ledger.movementType = type;

                ledger.quantityChange = scale(quantityChange);
                ledger.reservedChange = scale(reservedChange);
                ledger.blockedChange = scale(blockedChange);
                ledger.inTransitChange = scale(transitChange);

                ledger.onHandAfter = balance.onHandQty;
                ledger.reservedAfter = balance.reservedQty;
                ledger.blockedAfter = balance.blockedQty;
                ledger.inTransitAfter = balance.inTransitQty;

                ledger.referenceType = referenceType;
                ledger.referenceId = referenceId;
                ledger.referenceNumber = referenceNumber;
                ledger.batchNo = clean(batchNo);
                ledger.remarks = clean(remarks);
                ledger.actor = actor;

                ledgerRepository.save(ledger);
        }

        /*
         * MatFlow entities expose public JPA backing fields. A Hibernate lazy
         * proxy can therefore return a valid getId() while direct field access
         * (for example indentLine.requiredQty or purchaseOrder.status) still
         * reads the proxy's default null value. Always unwrap the Procurement
         * associations before business arithmetic or response mapping.
         */
        private MatFlowPurchaseOrder hydratePurchaseOrder(
                        MatFlowPurchaseOrder rawOrder) {
                if (rawOrder == null) {
                        return null;
                }

                MatFlowPurchaseOrder order = (MatFlowPurchaseOrder) Hibernate.unproxy(
                                rawOrder);

                if (order.vendor != null) {
                        order.vendor = (MatFlowVendor) Hibernate.unproxy(
                                        order.vendor);
                }

                if (order.indent != null) {
                        order.indent = hydrateIndent(
                                        order.indent);
                }

                if (order.deliveryLocation != null) {
                        order.deliveryLocation = (MatFlowLocation) Hibernate.unproxy(
                                        order.deliveryLocation);
                }

                return order;
        }

        private MatFlowPurchaseOrderLine hydratePurchaseOrderLine(
                        MatFlowPurchaseOrderLine rawLine) {
                if (rawLine == null) {
                        return null;
                }

                MatFlowPurchaseOrderLine line = (MatFlowPurchaseOrderLine) Hibernate.unproxy(
                                rawLine);

                if (line.purchaseOrder != null) {
                        line.purchaseOrder = hydratePurchaseOrder(
                                        line.purchaseOrder);
                }

                if (line.indentLine != null) {
                        line.indentLine = hydrateIndentLine(
                                        line.indentLine);
                }

                if (line.material != null) {
                        line.material = (MatFlowMaterial) Hibernate.unproxy(
                                        line.material);
                }

                return line;
        }

        private MatFlowIndent hydrateIndent(
                        MatFlowIndent rawIndent) {
                if (rawIndent == null) {
                        return null;
                }

                MatFlowIndent indent = (MatFlowIndent) Hibernate.unproxy(
                                rawIndent);

                if (indent.deliverToLocation != null) {
                        indent.deliverToLocation = (MatFlowLocation) Hibernate.unproxy(
                                        indent.deliverToLocation);
                }

                /*
                 * projectDrawing / requisition are accessed through getters in the
                 * workflow below, so Hibernate can initialize them when needed.
                 * We still unwrap requisition when present because Procurement
                 * later reads it while refreshing the consolidated MatFlow state.
                 */
                if (indent.requisition != null) {
                        indent.requisition = (com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition) Hibernate
                                        .unproxy(indent.requisition);
                }

                return indent;
        }

        private MatFlowIndentLine hydrateIndentLine(
                        MatFlowIndentLine rawLine) {
                if (rawLine == null) {
                        return null;
                }

                MatFlowIndentLine line = (MatFlowIndentLine) Hibernate.unproxy(
                                rawLine);

                if (line.indent != null) {
                        line.indent = hydrateIndent(
                                        line.indent);
                }

                if (line.material != null) {
                        line.material = (MatFlowMaterial) Hibernate.unproxy(
                                        line.material);
                }

                if (line.requisitionLine != null) {
                        line.requisitionLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                        line.requisitionLine);
                }

                return line;
        }

        private MatFlowIndentLine requirePurchaseOrderIndentLine(
                        MatFlowPurchaseOrderLine rawLine) {
                MatFlowPurchaseOrderLine line = hydratePurchaseOrderLine(
                                rawLine);

                if (line == null ||
                                line.indentLine == null ||
                                line.indentLine.getId() == null) {
                        throw conflict(
                                        "Purchase order line is not linked to a valid shortage indent line");
                }

                return line.indentLine;
        }

        private BigDecimal requireIndentRequiredQuantity(
                        MatFlowIndentLine rawLine) {
                MatFlowIndentLine line = hydrateIndentLine(
                                rawLine);

                if (line == null ||
                                line.getId() == null) {
                        throw conflict(
                                        "Purchase order is linked to an invalid shortage indent line");
                }

                BigDecimal requiredQty = scale(
                                line.requiredQty);

                if (requiredQty.compareTo(
                                BigDecimal.ZERO) > 0) {
                        return requiredQty;
                }

                /*
                 * Compatibility repair for older rows. Store creates an Indent
                 * line from the linked requisition shortage, so the requisition
                 * shortage is the only safe fallback if a historical requiredQty
                 * is genuinely null. Do not infer from requestedQty or PO totals,
                 * because that could silently authorize over-ordering.
                 */
                MatFlowRequisitionLine requisitionLine = line.requisitionLine == null
                                ? null
                                : (MatFlowRequisitionLine) Hibernate.unproxy(
                                                line.requisitionLine);

                BigDecimal shortageQty = requisitionLine == null
                                ? BigDecimal.ZERO
                                : scale(
                                                requisitionLine.shortageQty);

                if (shortageQty.compareTo(
                                BigDecimal.ZERO) > 0) {
                        line.requiredQty = shortageQty;
                        return shortageQty;
                }

                throw conflict(
                                "Indent line " +
                                                line.getId() +
                                                " has no valid required quantity. Refresh the Store shortage/Indent before approving this PO.");
        }

        private String materialCode(
                        MatFlowMaterial rawMaterial) {
                if (rawMaterial == null) {
                        return "UNKNOWN_MATERIAL";
                }

                MatFlowMaterial material = (MatFlowMaterial) Hibernate.unproxy(
                                rawMaterial);

                String code = clean(
                                material.getMaterialCode());

                return code == null
                                ? String.valueOf(
                                                material.getId())
                                : code;
        }

        private BigDecimal positive(
                        BigDecimal value,
                        String field) {
                if (value == null ||
                                value.compareTo(
                                                BigDecimal.ZERO) <= 0) {
                        throw badRequest(
                                        field +
                                                        " must be greater than zero");
                }

                return scale(value);
        }

        private BigDecimal scale(
                        BigDecimal value) {
                return value == null
                                ? BigDecimal.ZERO
                                : value.setScale(
                                                3,
                                                RoundingMode.HALF_UP);
        }

        private String generateNumber(
                        String prefix) {
                return prefix +
                                "-" +
                                LocalDate.now().getYear() +
                                "-" +
                                UUID.randomUUID()
                                                .toString()
                                                .replace("-", "")
                                                .substring(0, 8)
                                                .toUpperCase();
        }

        private void assertVersion(
                        Long requested,
                        Long current,
                        String entity) {
                if (requested == null) {
                        throw badRequest(
                                        entity +
                                                        " rowVersion is required");
                }

                if (!requested.equals(current)) {
                        throw conflict(
                                        entity +
                                                        " was modified by another user");
                }
        }

        private void required(
                        String value,
                        String field) {
                if (value == null ||
                                value.trim().isBlank()) {
                        throw badRequest(
                                        field + " is required");
                }
        }

        private String clean(String value) {
                if (value == null) {
                        return null;
                }

                String result = value.trim();

                return result.isBlank()
                                ? null
                                : result;
        }

        private ResponseStatusException badRequest(
                        String message) {
                return new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                message);
        }

        private ResponseStatusException conflict(
                        String message) {
                return new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                message);
        }

        private ResponseStatusException notFound(
                        String message) {
                return new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                message);
        }
}