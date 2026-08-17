package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.GoodsReceiptResponse;
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
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.GoodsReceiptStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLine;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowVendor;

import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
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
        private final MatFlowGoodsReceiptRepository receiptRepository;
        private final MatFlowGoodsReceiptLineRepository receiptLineRepository;
        private final MatFlowStockBalanceRepository stockRepository;
        private final MatFlowStockLedgerRepository ledgerRepository;
        private final MatFlowAccessService accessService;
        private final MatFlowAuditService auditService;
        private final MatFlowRequisitionService requisitionService;
        private final MatFlowDocumentNumberService documentNumberService;
        private final MatFlowPlantRoutingService plantRoutingService;

        public MatFlowProcurementService(
                        MatFlowPurchaseOrderRepository purchaseOrderRepository,
                        MatFlowPurchaseOrderLineRepository purchaseOrderLineRepository,
                        MatFlowIndentRepository indentRepository,
                        MatFlowIndentLineRepository indentLineRepository,
                        MatFlowVendorRepository vendorRepository,
                        MatFlowGoodsReceiptRepository receiptRepository,
                        MatFlowGoodsReceiptLineRepository receiptLineRepository,
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService,
                        MatFlowRequisitionService requisitionService,
                        MatFlowDocumentNumberService documentNumberService,
                        MatFlowPlantRoutingService plantRoutingService) {
                this.purchaseOrderRepository = purchaseOrderRepository;

                this.purchaseOrderLineRepository = purchaseOrderLineRepository;

                this.indentRepository = indentRepository;

                this.indentLineRepository = indentLineRepository;

                this.vendorRepository = vendorRepository;

                this.receiptRepository = receiptRepository;

                this.receiptLineRepository = receiptLineRepository;

                this.stockRepository = stockRepository;

                this.ledgerRepository = ledgerRepository;

                this.accessService = accessService;

                this.auditService = auditService;
                this.requisitionService = requisitionService;
                this.documentNumberService = documentNumberService;
                this.plantRoutingService = plantRoutingService;
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

                MatFlowIndent indent = hydrateIndent(
                                indentRepository.findById(request.indentId())
                                                .orElseThrow(() -> notFound("Purchase indent not found")));

                boolean purchaseReadyIndent = indent.status == IndentStatus.SUBMITTED_TO_PURCHASE ||
                                indent.status == IndentStatus.PURCHASE_IN_PROGRESS ||
                                indent.status == IndentStatus.PO_CREATED ||
                                indent.status == IndentStatus.PARTIALLY_RECEIVED;
                if (!purchaseReadyIndent) {
                        throw conflict("Purchase Order can be raised only against a PI submitted by Store. Current PI status: "
                                        + indent.status);
                }

                MatFlowVendor vendor = vendorRepository.findById(request.vendorId())
                                .orElseThrow(() -> notFound("Vendor not found"));
                if (!vendor.active) {
                        throw badRequest("Inactive vendor cannot be selected");
                }

                MatFlowLocation mainStore = plantRoutingService.requireMainStore();
                plantRoutingService.assertMainStoreLocation(mainStore, "Purchase Order delivery");
                if (indent.deliverToLocation == null
                                || !mainStore.getId().equals(indent.deliverToLocation.getId())) {
                        throw conflict("Linked PI must be delivered to AL-P1 Main Store");
                }

                String actor = accessService.actor();
                MatFlowPurchaseOrder order = new MatFlowPurchaseOrder();
                order.poNumber = documentNumberService.nextPo();
                order.poDate = request.poDate();
                order.vendor = vendor;
                order.indent = indent;
                order.deliveryLocation = mainStore;
                // Purchase owns PO creation and placement. There is no approval desk.
                order.status = PurchaseOrderStatus.PLACED;
                // Legacy columns are retained as placement audit mirrors for existing DB/API rows.
                order.approvedBy = actor;
                order.approvedAt = LocalDateTime.now();
                order.approvalRemarks = "Placed by Purchase";
                order.remarks = clean(request.remarks());
                order.setCreatedBy(actor);
                order.setUpdatedBy(actor);
                order = purchaseOrderRepository.save(order);

                Set<UUID> uniqueIndentLines = new HashSet<>();
                for (PurchaseOrderLineRequest lineRequest : request.lines()) {
                        if (lineRequest == null || lineRequest.indentLineId() == null) {
                                throw badRequest("Every PO line requires a PI line");
                        }
                        if (!uniqueIndentLines.add(lineRequest.indentLineId())) {
                                throw badRequest("A PI line was selected more than once");
                        }

                        MatFlowIndentLine indentLine = hydrateIndentLine(
                                        indentLineRepository
                                                        .findByIdAndIndent_Id(lineRequest.indentLineId(),
                                                                        indent.getId())
                                                        .orElseThrow(() -> badRequest(
                                                                        "PI line does not belong to the selected PI")));
                        BigDecimal orderedQty = positive(lineRequest.orderedQty(), "Ordered quantity");
                        BigDecimal requiredQty = requireIndentRequiredQuantity(indentLine);
                        BigDecimal committed = committedOrderedQuantity(indentLine.getId(), null);
                        BigDecimal remaining = requiredQty.subtract(committed).max(BigDecimal.ZERO)
                                        .setScale(3, RoundingMode.HALF_UP);
                        if (orderedQty.compareTo(remaining) > 0) {
                                throw conflict("Ordered quantity exceeds outstanding PI quantity for "
                                                + materialCode(indentLine.material));
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
                        purchaseOrderLineRepository.save(line);

                        // The just-created PLACED PO is now a real commercial commitment.
                        indentLine.orderedQty = scale(indentLine.orderedQty).add(orderedQty)
                                        .setScale(3, RoundingMode.HALF_UP);
                        indentLine.setUpdatedBy(actor);
                        indentLineRepository.save(indentLine);
                }

                refreshIndentOrderingStatus(indent, actor);
                if (indent.requisition != null && indent.requisition.getId() != null) {
                        requisitionService.refreshState(indent.requisition.getId(), actor);
                }

                auditService.record(
                                "PURCHASE_ORDER", order.getId(), "PURCHASE_ORDER_PLACED",
                                mainStore.getPlantCode(),
                                indent.projectDrawing == null ? null : indent.projectDrawing.getProjectCode(),
                                indent.projectDrawing == null ? null : indent.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "poNumber", order.poNumber,
                                                "piNumber", indent.indentNumber,
                                                "linkedMr",
                                                indent.requisition == null ? null
                                                                : indent.requisition.requisitionNumber,
                                                "vendor", vendor.vendorName,
                                                "lineCount", request.lines().size(),
                                                "status", order.status));

                return toPurchaseOrderResponse(order);
        }

        @Transactional(readOnly = true)
        public List<GoodsReceiptResponse> listGoodsReceipts() {
                accessService.requireRead();

                return receiptRepository
                                .findAllByOrderByReceivedAtDesc()
                                .stream()
                                .map(this::hydrateGoodsReceipt)
                                .filter(receipt -> receipt != null && receipt.receiptLocation != null)
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

                MatFlowPurchaseOrder order = requirePurchaseOrder(request.purchaseOrderId());
                if (order.status != PurchaseOrderStatus.PLACED &&
                                order.status != PurchaseOrderStatus.PARTIALLY_RECEIVED) {
                        throw conflict("Purchase Order is not open for receipt");
                }

                MatFlowLocation receiptLocation = order.deliveryLocation == null
                                ? plantRoutingService.requireMainStore()
                                : order.deliveryLocation;
                plantRoutingService.assertMainStoreLocation(receiptLocation, "GRN inward");

                String actor = accessService.actor();
                MatFlowGoodsReceipt receipt = new MatFlowGoodsReceipt();
                receipt.grnNumber = documentNumberService.nextGrn();
                receipt.purchaseOrder = order;
                receipt.receiptLocation = receiptLocation;
                receipt.vendorChallanNo = clean(request.vendorChallanNo());
                receipt.vendorInvoiceNo = clean(request.vendorInvoiceNo());
                // GRN means inward completed. QC is a later Store allocation decision,
                // not an automatic consequence of vendor receipt.
                receipt.status = GoodsReceiptStatus.ACCEPTED;
                receipt.receivedBy = actor;
                receipt.receivedAt = LocalDateTime.now();
                receipt.remarks = clean(request.remarks());
                receipt.setCreatedBy(actor);
                receipt.setUpdatedBy(actor);
                receipt = receiptRepository.save(receipt);

                Set<UUID> uniquePoLines = new HashSet<>();
                for (GoodsReceiptLineRequest lineRequest : request.lines()) {
                        if (lineRequest == null || lineRequest.purchaseOrderLineId() == null) {
                                throw badRequest("Every GRN line requires a PO line");
                        }
                        if (!uniquePoLines.add(lineRequest.purchaseOrderLineId())) {
                                throw badRequest("A PO line was selected more than once");
                        }

                        MatFlowPurchaseOrderLine poLine = purchaseOrderLineRepository
                                        .findByIdAndPurchaseOrder_Id(lineRequest.purchaseOrderLineId(), order.getId())
                                        .map(this::hydratePurchaseOrderLine)
                                        .orElseThrow(() -> badRequest(
                                                        "PO line does not belong to the selected Purchase Order"));
                        MatFlowIndentLine indentLine = requirePurchaseOrderIndentLine(poLine);
                        if (indentLine.requisitionLine == null || indentLine.requisitionLine.getId() == null ||
                                        indentLine.requisitionLine.requisition == null ||
                                        indentLine.requisitionLine.requisition.getId() == null) {
                                throw conflict("PO line is not linked to a valid MR shortage line");
                        }

                        BigDecimal receivedQty = positive(lineRequest.receivedQty(), "Received quantity");
                        BigDecimal outstanding = scale(poLine.orderedQty).subtract(scale(poLine.receivedQty))
                                        .max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);
                        if (receivedQty.compareTo(outstanding) > 0) {
                                throw conflict("Received quantity exceeds outstanding PO quantity for "
                                                + materialCode(poLine.material));
                        }

                        MatFlowGoodsReceiptLine receiptLine = new MatFlowGoodsReceiptLine();
                        receiptLine.goodsReceipt = receipt;
                        receiptLine.purchaseOrderLine = poLine;
                        receiptLine.material = poLine.material;
                        receiptLine.receivedQty = receivedQty;
                        // GRN records the commercial/physical inward event only. Tally is the
                        // physical stock authority. When Main Store later reviews the linked MR,
                        // Store checks Tally and declares FULL / PARTIAL / NOT AVAILABLE.
                        receiptLine.acceptedQty = receivedQty;
                        receiptLine.rejectedQty = BigDecimal.ZERO;
                        receiptLine.returnedQty = BigDecimal.ZERO;
                        receiptLine.uom = poLine.uom;
                        receiptLine.batchNo = clean(lineRequest.batchNo());
                        receiptLine.setCreatedBy(actor);
                        receiptLine.setUpdatedBy(actor);
                        receiptLine = receiptLineRepository.save(receiptLine);

                        poLine.receivedQty = scale(poLine.receivedQty).add(receivedQty).setScale(3,
                                        RoundingMode.HALF_UP);
                        poLine.setUpdatedBy(actor);
                        purchaseOrderLineRepository.save(poLine);

                        BigDecimal indentRemaining = requireIndentRequiredQuantity(indentLine)
                                        .subtract(scale(indentLine.receivedQty)).max(BigDecimal.ZERO);
                        BigDecimal credited = receivedQty.min(indentRemaining).setScale(3, RoundingMode.HALF_UP);
                        indentLine.receivedQty = scale(indentLine.receivedQty).add(credited).setScale(3,
                                        RoundingMode.HALF_UP);
                        indentLine.setUpdatedBy(actor);
                        indentLineRepository.save(indentLine);

                        /*
                         * Keep a zero/free-running technical balance row only because the immutable
                         * MatFlow ledger and downstream custody model reference a location balance.
                         * GRN must NOT increase MatFlow Store on-hand quantity: Tally owns the actual
                         * stock balance. The RECEIPT ledger event remains for PI/PO/GRN usage history.
                         */
                        MatFlowStockBalance balance = lockOrCreateBalance(poLine.material, receiptLocation, actor);
                        balance.setUpdatedBy(actor);
                        balance = stockRepository.save(balance);

                        saveLedger(
                                        balance, MovementType.RECEIPT,
                                        receivedQty, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                                        "MATFLOW_GRN", receipt.getId(), receipt.grnNumber,
                                        receiptLine.batchNo,
                                        "Vendor receipt recorded against PI/PO/GRN; physical Store stock remains in Tally",
                                        actor);
                }

                refreshPurchaseOrderReceiptStatus(order, actor);
                refreshIndentReceiptStatus(order.indent, actor);
                if (order.indent != null && order.indent.requisition != null) {
                        requisitionService.refreshState(order.indent.requisition.getId(), actor);
                }

                auditService.record(
                                "GOODS_RECEIPT", receipt.getId(), "GRN_POSTED_TO_STORE",
                                receiptLocation.getPlantCode(),
                                order.indent == null || order.indent.projectDrawing == null ? null
                                                : order.indent.projectDrawing.getProjectCode(),
                                order.indent == null || order.indent.projectDrawing == null ? null
                                                : order.indent.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "grnNumber", receipt.grnNumber,
                                                "poNumber", order.poNumber,
                                                "piNumber", order.indent == null ? null : order.indent.indentNumber,
                                                "linkedMr",
                                                order.indent == null || order.indent.requisition == null ? null
                                                                : order.indent.requisition.requisitionNumber,
                                                "vendor", order.vendor == null ? null : order.vendor.vendorName,
                                                "lineCount", request.lines().size(),
                                                "status", receipt.status));
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

        private void refreshIndentReceiptStatus(
                        MatFlowIndent rawIndent,
                        String actor) {
                MatFlowIndent indent = hydrateIndent(rawIndent);
                if (indent == null || indent.getId() == null) {
                        return;
                }
                List<MatFlowIndentLine> lines = indentLineRepository
                                .findByIndent_IdOrderByCreatedAtAsc(indent.getId())
                                .stream().map(this::hydrateIndentLine).toList();
                boolean fullyReceived = !lines.isEmpty() && lines.stream().allMatch(
                                line -> scale(line.receivedQty).compareTo(requireIndentRequiredQuantity(line)) >= 0);
                boolean anyReceived = lines.stream()
                                .anyMatch(line -> scale(line.receivedQty).compareTo(BigDecimal.ZERO) > 0);
                indent.status = fullyReceived
                                ? IndentStatus.RECEIVED
                                : anyReceived
                                                ? IndentStatus.PARTIALLY_RECEIVED
                                                : IndentStatus.PURCHASE_IN_PROGRESS;
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
                                        "Purchase order delivery Store is missing");
                }

                accessService.requirePlantAccess(
                                order.deliveryLocation.getPlantCode());

                return order;
        }

        private void validatePurchaseRequest(
                        PurchaseOrderRequest request) {
                if (request == null) {
                        throw badRequest(
                                        "Purchase order request is required");
                }

                if (request.poDate() == null) {
                        throw badRequest(
                                        "PO date is required");
                }

                if (request.vendorId() == null ||
                                request.indentId() == null) {
                        throw badRequest(
                                        "Vendor and Purchase Indent are required");
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
                                request.purchaseOrderId() == null) {
                        throw badRequest(
                                        "Purchase Order is required");
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

                MatFlowMaterialRequisition linkedRequisition = order.indent == null
                                ? null
                                : order.indent.requisition;
                MatFlowProjectDrawing linkedProduct = order.indent == null
                                ? null
                                : order.indent.projectDrawing;

                return new PurchaseOrderResponse(
                                order.getId(),
                                order.poNumber,
                                order.poDate,
                                order.vendor.getId(),
                                order.vendor.vendorCode,
                                order.vendor.vendorName,
                                order.indent.getId(),
                                order.indent.indentNumber,
                                linkedRequisition == null ? null : linkedRequisition.getId(),
                                linkedRequisition == null ? null : linkedRequisition.requisitionNumber,
                                linkedProduct == null ? null : linkedProduct.getId(),
                                linkedProduct == null ? null : linkedProduct.getProjectCode(),
                                linkedProduct == null ? null : linkedProduct.getDrawingNo(),
                                linkedProduct == null ? null : linkedProduct.getProductName(),
                                linkedProduct == null ? null : linkedProduct.getClientName(),
                                order.deliveryLocation.getPlantCode(),
                                order.status,
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

                MatFlowPurchaseOrder order = hydratePurchaseOrder(receipt.purchaseOrder);
                MatFlowIndent indent = order == null ? null : order.indent;
                MatFlowMaterialRequisition linkedRequisition = indent == null ? null : indent.requisition;
                MatFlowProjectDrawing linkedProduct = indent == null ? null : indent.projectDrawing;

                return new GoodsReceiptResponse(
                                receipt.getId(),
                                receipt.grnNumber,
                                order == null ? null : order.getId(),
                                order == null ? null : order.poNumber,
                                indent == null ? null : indent.getId(),
                                indent == null ? null : indent.indentNumber,
                                linkedRequisition == null ? null : linkedRequisition.getId(),
                                linkedRequisition == null ? null : linkedRequisition.requisitionNumber,
                                linkedProduct == null ? null : linkedProduct.getId(),
                                linkedProduct == null ? null : linkedProduct.getProjectCode(),
                                linkedProduct == null ? null : linkedProduct.getDrawingNo(),
                                linkedProduct == null ? null : linkedProduct.getProductName(),
                                linkedProduct == null ? null : linkedProduct.getClientName(),
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
        private MatFlowGoodsReceipt hydrateGoodsReceipt(
                        MatFlowGoodsReceipt rawReceipt) {
                if (rawReceipt == null) {
                        return null;
                }

                MatFlowGoodsReceipt receipt = (MatFlowGoodsReceipt) Hibernate.unproxy(rawReceipt);

                if (receipt.purchaseOrder != null) {
                        receipt.purchaseOrder = hydratePurchaseOrder(receipt.purchaseOrder);
                }

                if (receipt.receiptLocation != null) {
                        receipt.receiptLocation = (MatFlowLocation) Hibernate.unproxy(receipt.receiptLocation);
                }

                return receipt;
        }

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
                        indent.requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(indent.requisition);
                }

                if (indent.projectDrawing != null) {
                        indent.projectDrawing = (MatFlowProjectDrawing) Hibernate.unproxy(indent.projectDrawing);
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
                        MatFlowRequisitionLine requisitionLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                        line.requisitionLine);

                        if (requisitionLine.material != null) {
                                requisitionLine.material = (MatFlowMaterial) Hibernate.unproxy(
                                                requisitionLine.material);
                        }

                        if (requisitionLine.requisition != null) {
                                requisitionLine.requisition = (com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition) Hibernate
                                                .unproxy(requisitionLine.requisition);

                                if (requisitionLine.requisition.destinationLocation != null) {
                                        requisitionLine.requisition.destinationLocation = (MatFlowLocation) Hibernate
                                                        .unproxy(
                                                                        requisitionLine.requisition.destinationLocation);
                                }
                        }

                        line.requisitionLine = requisitionLine;
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