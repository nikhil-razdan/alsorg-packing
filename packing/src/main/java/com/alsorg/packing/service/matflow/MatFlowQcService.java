package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcDecisionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcInspectionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowQcRoutingDtos.ProcessingRouteOption;
import com.alsorg.packing.controller.dto.matflow.MatFlowQcRoutingDtos.QcRoutingRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowQcRoutingDtos.QcRoutingResponse;

import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.*;
import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * MatFlow QC check service.
 *
 * QC is intentionally not a custody location and does not choose a route. New
 * MR-linked QC work is a simple completion/tick gate with optional photo
 * evidence.
 * Store owns the physical Processing/Production route before the QC check is
 * done.
 * Legacy rejected-material helpers remain for historical rows only.
 */
@Service
public class MatFlowQcService {

        private final QcModule qc;
        private final DispositionModule disposition;

        public MatFlowQcService(
                        MatFlowQcInspectionRepository qcRepository,
                        MatFlowGoodsReceiptRepository receiptRepository,
                        MatFlowGoodsReceiptLineRepository receiptLineRepository,
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowReservationRepository reservationRepository,
                        MatFlowRequisitionLineRepository requisitionLineRepository,
                        MatFlowIndentRepository indentRepository,
                        MatFlowIndentLineRepository indentLineRepository,
                        MatFlowPurchaseOrderRepository purchaseOrderRepository,
                        MatFlowTransferOrderRepository transferRepository,
                        MatFlowTransferLineRepository transferLineRepository,
                        MatFlowVendorReturnRepository vendorReturnRepository,
                        MatFlowQcDispositionRepository dispositionRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowBomService bomService,
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService,
                        MatFlowRequisitionService requisitionService,
                        MatFlowQcEvidenceService evidenceService,
                        MatFlowPlantRoutingService plantRoutingService) {

                this.qc = new QcModule(
                                qcRepository,
                                receiptRepository,
                                receiptLineRepository,
                                stockRepository,
                                ledgerRepository,
                                reservationRepository,
                                requisitionLineRepository,
                                indentRepository,
                                indentLineRepository,
                                purchaseOrderRepository,
                                transferRepository,
                                transferLineRepository,
                                vendorReturnRepository,
                                bomService,
                                accessService,
                                auditService,
                                requisitionService,
                                evidenceService,
                                plantRoutingService);

                this.disposition = new DispositionModule(
                                dispositionRepository,
                                qcRepository,
                                transferRepository,
                                transferLineRepository,
                                reservationRepository,
                                requisitionLineRepository,
                                indentRepository,
                                indentLineRepository,
                                locationRepository,
                                stockRepository,
                                ledgerRepository,
                                accessService,
                                auditService);
        }

        @Transactional(readOnly = true)
        public List<QcInspectionResponse> listInspections(QcInspectionStatus status) {
                return qc.list(status);
        }

        @Transactional
        public QcInspectionResponse decide(UUID inspectionId, QcDecisionRequest request) {
                return qc.decide(inspectionId, request);
        }

        @Transactional(readOnly = true)
        public QcInspectionResponse getInspection(UUID inspectionId) {
                return qc.get(inspectionId);
        }

        @Transactional(readOnly = true)
        public List<QcRoutingResponse> listRouting() {
                return qc.listRouting();
        }

        @Transactional(readOnly = true)
        public QcRoutingResponse routing(UUID inspectionId) {
                return qc.routing(inspectionId);
        }

        @Transactional
        public QcRoutingResponse route(UUID inspectionId, QcRoutingRequest request) {
                return qc.route(inspectionId, request);
        }

        @Transactional
        public VendorReturnResponse returnToVendor(UUID inspectionId, VendorReturnRequest request) {
                return qc.returnToVendor(inspectionId, request);
        }

        @Transactional(readOnly = true)
        public List<QcDispositionResponse> listDispositions() {
                return disposition.list();
        }

        @Transactional
        public QcDispositionResponse decideDisposition(UUID inspectionId, QcDispositionRequest request) {
                return disposition.decide(inspectionId, request);
        }

        private static final class QcModule {

                private final MatFlowQcInspectionRepository qcRepository;
                private final MatFlowGoodsReceiptRepository receiptRepository;
                private final MatFlowGoodsReceiptLineRepository receiptLineRepository;
                private final MatFlowStockBalanceRepository stockRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowReservationRepository reservationRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowIndentRepository indentRepository;
                private final MatFlowIndentLineRepository indentLineRepository;
                private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowTransferLineRepository transferLineRepository;
                private final MatFlowVendorReturnRepository vendorReturnRepository;
                private final MatFlowBomService routingService;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;
                private final MatFlowRequisitionService requisitionService;
                private final MatFlowQcEvidenceService evidenceService;
                private final MatFlowPlantRoutingService plantRoutingService;

                QcModule(
                                MatFlowQcInspectionRepository qcRepository,
                                MatFlowGoodsReceiptRepository receiptRepository,
                                MatFlowGoodsReceiptLineRepository receiptLineRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowIndentRepository indentRepository,
                                MatFlowIndentLineRepository indentLineRepository,
                                MatFlowPurchaseOrderRepository purchaseOrderRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowTransferLineRepository transferLineRepository,
                                MatFlowVendorReturnRepository vendorReturnRepository,
                                MatFlowBomService routingService,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService,
                                MatFlowRequisitionService requisitionService,
                                MatFlowQcEvidenceService evidenceService,
                                MatFlowPlantRoutingService plantRoutingService) {
                        this.qcRepository = qcRepository;

                        this.receiptRepository = receiptRepository;

                        this.receiptLineRepository = receiptLineRepository;

                        this.stockRepository = stockRepository;

                        this.ledgerRepository = ledgerRepository;

                        this.reservationRepository = reservationRepository;

                        this.requisitionLineRepository = requisitionLineRepository;

                        this.indentRepository = indentRepository;

                        this.indentLineRepository = indentLineRepository;

                        this.purchaseOrderRepository = purchaseOrderRepository;

                        this.transferRepository = transferRepository;

                        this.transferLineRepository = transferLineRepository;

                        this.vendorReturnRepository = vendorReturnRepository;

                        this.routingService = routingService;

                        this.accessService = accessService;

                        this.auditService = auditService;
                        this.requisitionService = requisitionService;
                        this.evidenceService = evidenceService;
                        this.plantRoutingService = plantRoutingService;
                }

                @Transactional(readOnly = true)
                public List<QcInspectionResponse> list(
                                QcInspectionStatus status) {
                        accessService.requireRead();

                        List<MatFlowQcInspection> inspections = status == null
                                        ? qcRepository
                                                        .findAllByOrderByCreatedAtDesc()
                                        : qcRepository
                                                        .findByStatusOrderByCreatedAtAsc(
                                                                        status);

                        return inspections
                                        .stream()
                                        .map(this::hydrateInspection)
                                        .filter(inspection -> inspection != null &&
                                                        inspection.location != null)
                                        .filter(inspection -> accessService.canAccessPlant(
                                                        inspection.location.getPlantCode()))
                                        .map(this::toResponse)
                                        .toList();
                }

                @Transactional(readOnly = true)
                public QcInspectionResponse get(UUID id) {
                        accessService.requireRead();
                        return toResponse(requireInspection(id));
                }

                @Transactional
                public QcInspectionResponse decide(
                                UUID id,
                                QcDecisionRequest request) {
                        accessService.requireQcWrite();

                        if (request == null) {
                                throw badRequest(
                                                "QC decision request is required");
                        }

                        MatFlowQcInspection inspection = requireInspection(id);

                        if (inspection.status != QcInspectionStatus.PENDING) {
                                throw conflict(
                                                "QC inspection is already completed");
                        }

                        assertVersion(
                                        request.rowVersion(),
                                        inspection.getRowVersion());

                        /*
                         * Current workflow: a Store-created reservation QC row is only a
                         * check/tick. It does not move stock, create a QC location or select
                         * a route. Completing the check simply unlocks the route Store
                         * already selected during MR allocation.
                         */
                        if (isSimpleReservationCheck(inspection)) {
                                return completeReservationQcCheck(inspection, request);
                        }

                        /*
                         * Historical compatibility: old pending physical-QC rows may still
                         * exist in the database. The new UI no longer asks for accepted /
                         * rejected quantities, so completing one legacy row treats the full
                         * quantity as checked/accepted and preserves its existing downstream
                         * execution logic.
                         */
                        BigDecimal accepted = scale(inspection.inspectionQty);
                        BigDecimal rejected = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

                        BigDecimal decidedQty = accepted.add(rejected);

                        if (decidedQty.compareTo(
                                        inspection.inspectionQty) != 0) {
                                throw badRequest(
                                                "Accepted and rejected quantities must equal the inspection quantity");
                        }

                        MatFlowStockBalance balance = stockRepository
                                        .lockBalance(
                                                        inspection.material
                                                                        .getId(),
                                                        inspection.location
                                                                        .getId())
                                        .orElseThrow(() -> conflict(
                                                        "QC stock balance not found"));

                        /*
                         * The complete inspection quantity must still be blocked.
                         * Accepted stock is released from blocked stock.
                         * Rejected stock remains blocked for disposition.
                         */
                        if (balance.blockedQty
                                        .compareTo(
                                                        inspection.inspectionQty) < 0) {
                                throw conflict(
                                                "Blocked stock is insufficient for the complete QC inspection quantity");
                        }

                        String actor = accessService.actor();

                        balance.blockedQty = scale(
                                        balance.blockedQty
                                                        .subtract(accepted));

                        BigDecimal reservedAdded = BigDecimal.ZERO;

                        if (inspection.sourceType == QcSourceType.GOODS_RECEIPT) {
                                reservedAdded = allocateAcceptedGoodsReceipt(
                                                inspection,
                                                accepted,
                                                actor);
                        } else {
                                reservedAdded = completeTransferQc(
                                                inspection,
                                                accepted,
                                                rejected,
                                                actor);
                        }

                        balance.reservedQty = scale(
                                        balance.reservedQty
                                                        .add(reservedAdded));

                        if (balance.reservedQty
                                        .add(balance.blockedQty)
                                        .compareTo(
                                                        balance.onHandQty) > 0) {
                                throw conflict(
                                                "QC decision would make reserved and blocked stock exceed physical stock");
                        }

                        balance.setUpdatedBy(actor);

                        balance = stockRepository.save(balance);

                        inspection.acceptedQty = accepted;

                        inspection.rejectedQty = rejected;

                        inspection.status = QcInspectionStatus.COMPLETED;

                        inspection.inspectedBy = actor;

                        inspection.inspectedAt = LocalDateTime.now();

                        inspection.remarks = clean(request.remarks());

                        inspection.setUpdatedBy(actor);

                        inspection = qcRepository.save(inspection);

                        saveLedger(
                                        balance,
                                        MovementType.QC_RELEASE,

                                        BigDecimal.ZERO,
                                        reservedAdded,
                                        accepted.negate(),
                                        BigDecimal.ZERO,

                                        inspection,
                                        "QC completed",
                                        actor);

                        QcBusinessContext businessContext = resolveBusinessContext(inspection);
                        MatFlowMaterialRequisition auditRequisition = businessContext.requisition();

                        auditService.record(
                                        "QC_INSPECTION",
                                        inspection.getId(),
                                        "QC_COMPLETED",
                                        inspection.location.getPlantCode(),
                                        auditRequisition == null || auditRequisition.projectDrawing == null
                                                        ? null
                                                        : auditRequisition.projectDrawing.getProjectCode(),
                                        auditRequisition == null || auditRequisition.projectDrawing == null
                                                        ? null
                                                        : auditRequisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "requisitionNumber", businessContext.requisitionNumber(),
                                                        "indentNumbers", businessContext.indentNumbers(),
                                                        "purchaseOrderNumbers", businessContext.purchaseOrderNumbers(),
                                                        "grnNumbers", businessContext.grnNumbers(),
                                                        "materialCode",
                                                        inspection.material.getMaterialCode(),
                                                        "inspectionQty",
                                                        inspection.inspectionQty,
                                                        "acceptedQty",
                                                        inspection.acceptedQty,
                                                        "rejectedQty",
                                                        inspection.rejectedQty,
                                                        "sourceType",
                                                        inspection.sourceType));

                        return toResponse(inspection);
                }

                private boolean isSimpleReservationCheck(MatFlowQcInspection inspection) {
                        return inspection != null
                                        && inspection.routingReservationId != null
                                        && inspection.routingReservationId.equals(inspection.sourceId)
                                        && inspection.routingReservationId.equals(inspection.sourceLineId);
                }

                private QcInspectionResponse completeReservationQcCheck(
                                MatFlowQcInspection inspection,
                                QcDecisionRequest request) {
                        MatFlowReservation reservation = reservationRepository
                                        .findById(inspection.routingReservationId)
                                        .map(value -> (MatFlowReservation) Hibernate.unproxy(value))
                                        .orElseThrow(() -> conflict(
                                                        "QC check is not linked to a valid MR reservation"));

                        if (reservation.requisitionLine == null || reservation.requisitionLine.getId() == null) {
                                throw conflict("QC check reservation has no MR material line");
                        }

                        MatFlowRequisitionLine line = requisitionLineRepository
                                        .findById(reservation.requisitionLine.getId())
                                        .map(value -> (MatFlowRequisitionLine) Hibernate.unproxy(value))
                                        .orElseThrow(() -> conflict("QC check MR material line no longer exists"));
                        if (line.requisition == null || line.requisition.getId() == null) {
                                throw conflict("QC check is not linked to a valid Material Requisition");
                        }

                        MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate
                                        .unproxy(line.requisition);
                        if (inspection.location == null) {
                                throw conflict("QC check has no Main Store custody location");
                        }
                        plantRoutingService.assertMainStoreLocation(inspection.location, "MatFlow QC");
                        accessService.requirePlantAccess(MatFlowPlantRoutingService.MAIN_STORE_PLANT);

                        String actor = accessService.actor();
                        inspection.acceptedQty = scale(inspection.inspectionQty);
                        inspection.rejectedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                        inspection.status = QcInspectionStatus.COMPLETED;
                        inspection.inspectedBy = actor;
                        inspection.inspectedAt = LocalDateTime.now();
                        inspection.remarks = clean(request.remarks());
                        inspection.setUpdatedBy(actor);
                        inspection = qcRepository.save(inspection);

                        /* Unlock only the first Store-origin hand-off. */
                        transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId())
                                        .stream()
                                        .filter(transfer -> transfer != null && transfer.predecessorTransferId == null)
                                        .findFirst()
                                        .ifPresent(first -> {
                                                if (first.status == TransferStatus.PLANNED) {
                                                        first.status = TransferStatus.READY;
                                                        first.setUpdatedBy(actor);
                                                        transferRepository.save(first);
                                                }
                                        });

                        QcBusinessContext context = resolveBusinessContext(inspection);
                        MatFlowProjectDrawing product = requisition.projectDrawing == null
                                        ? null
                                        : (MatFlowProjectDrawing) Hibernate.unproxy(requisition.projectDrawing);

                        auditService.record(
                                        "QC_CHECK",
                                        inspection.getId(),
                                        "QC_CHECK_COMPLETED",
                                        inspection.location == null ? null : inspection.location.getPlantCode(),
                                        product == null ? null : product.getProjectCode(),
                                        product == null ? null : product.getDrawingNo(),
                                        auditService.details(
                                                        "requisitionNumber", context.requisitionNumber(),
                                                        "indentNumbers", context.indentNumbers(),
                                                        "purchaseOrderNumbers", context.purchaseOrderNumbers(),
                                                        "grnNumbers", context.grnNumbers(),
                                                        "materialCode", inspection.material == null
                                                                        ? null
                                                                        : inspection.material.getMaterialCode(),
                                                        "quantity", inspection.inspectionQty,
                                                        "photoAvailable", evidenceService.exists(inspection.getId()),
                                                        "nextRouteOwnedBy", "STORE"));

                        requisitionService.refreshState(requisition.getId(), actor);
                        return toResponse(inspection);
                }

                @Transactional
                public VendorReturnResponse returnToVendor(
                                UUID inspectionId,
                                VendorReturnRequest request) {
                        accessService.requireVendorReturnWrite();

                        MatFlowQcInspection inspection = requireInspection(
                                        inspectionId);

                        if (inspection.sourceType != QcSourceType.GOODS_RECEIPT) {
                                throw conflict(
                                                "Only vendor-received material can be returned to a vendor");
                        }

                        if (inspection.status != QcInspectionStatus.COMPLETED) {
                                throw conflict(
                                                "QC must be completed before vendor return");
                        }

                        assertVersion(
                                        request == null
                                                        ? null
                                                        : request.rowVersion(),
                                        inspection.getRowVersion());

                        MatFlowGoodsReceiptLine receiptLine = requireGoodsReceiptLineForQc(
                                        inspection);

                        BigDecimal outstanding = receiptLine.rejectedQty
                                        .subtract(
                                                        receiptLine.returnedQty);

                        BigDecimal returnQty = positive(
                                        request == null
                                                        ? null
                                                        : request.returnQty(),
                                        "Return quantity");

                        if (returnQty.compareTo(
                                        outstanding) > 0) {
                                throw conflict(
                                                "Return quantity exceeds rejected stock");
                        }

                        MatFlowStockBalance balance = stockRepository
                                        .lockBalance(
                                                        inspection.material
                                                                        .getId(),
                                                        inspection.location
                                                                        .getId())
                                        .orElseThrow(() -> conflict(
                                                        "Rejected stock balance not found"));

                        if (balance.onHandQty
                                        .compareTo(returnQty) < 0 ||
                                        balance.blockedQty
                                                        .compareTo(returnQty) < 0) {
                                throw conflict(
                                                "Rejected stock is no longer available for return");
                        }

                        String actor = accessService.actor();

                        balance.onHandQty = scale(
                                        balance.onHandQty
                                                        .subtract(returnQty));

                        balance.blockedQty = scale(
                                        balance.blockedQty
                                                        .subtract(returnQty));

                        balance.setUpdatedBy(actor);

                        balance = stockRepository.save(balance);

                        receiptLine.returnedQty = scale(
                                        receiptLine.returnedQty
                                                        .add(returnQty));

                        receiptLine.setUpdatedBy(actor);

                        receiptLineRepository.save(
                                        receiptLine);

                        MatFlowVendorReturn vendorReturn = new MatFlowVendorReturn();

                        vendorReturn.returnNumber = generateNumber("MVR");

                        vendorReturn.qcInspection = inspection;

                        if (receiptLine.goodsReceipt == null ||
                                        receiptLine.goodsReceipt.purchaseOrder == null ||
                                        receiptLine.goodsReceipt.purchaseOrder.vendor == null) {
                                throw conflict(
                                                "GRN line is not linked to a valid Purchase Order vendor");
                        }

                        vendorReturn.vendor = receiptLine.goodsReceipt.purchaseOrder.vendor;

                        vendorReturn.material = inspection.material;

                        vendorReturn.fromLocation = inspection.location;

                        vendorReturn.returnQty = returnQty;

                        vendorReturn.status = VendorReturnStatus.DISPATCHED;

                        vendorReturn.dispatchedBy = actor;

                        vendorReturn.dispatchedAt = LocalDateTime.now();

                        vendorReturn.remarks = request == null
                                        ? null
                                        : clean(request.remarks());

                        vendorReturn.setCreatedBy(actor);
                        vendorReturn.setUpdatedBy(actor);

                        vendorReturn = vendorReturnRepository.save(
                                        vendorReturn);

                        saveLedger(
                                        balance,
                                        MovementType.RETURN_TO_VENDOR,

                                        returnQty.negate(),
                                        BigDecimal.ZERO,
                                        returnQty.negate(),
                                        BigDecimal.ZERO,

                                        inspection,
                                        "Rejected material returned to vendor",
                                        actor);

                        refreshGoodsReceiptStatus(
                                        receiptLine.goodsReceipt,
                                        actor);

                        return toVendorReturnResponse(
                                        vendorReturn);
                }

                private BigDecimal allocateAcceptedGoodsReceipt(
                                MatFlowQcInspection inspection,
                                BigDecimal accepted,
                                String actor) {
                        /*
                         * MatFlow entities expose public JPA backing fields. A lazy
                         * association can therefore have a valid getId() while direct
                         * public-field access on the proxy still appears null. Resolve
                         * the complete GRN -> PO line -> Indent line -> Requisition
                         * lineage before reading business fields.
                         */
                        MatFlowGoodsReceiptLine receiptLine = requireGoodsReceiptLineForQc(
                                        inspection);

                        BigDecimal rejected = scale(
                                        scale(inspection.inspectionQty)
                                                        .subtract(scale(accepted)));

                        receiptLine.acceptedQty = scale(accepted);
                        receiptLine.rejectedQty = rejected;
                        receiptLine.setUpdatedBy(actor);
                        receiptLineRepository.save(receiptLine);

                        MatFlowPurchaseOrderLine purchaseOrderLine = receiptLine.purchaseOrderLine;
                        MatFlowIndentLine indentLine = purchaseOrderLine.indentLine;
                        MatFlowRequisitionLine requisitionLine = indentLine.requisitionLine;
                        MatFlowMaterialRequisition requisition = requisitionLine.requisition;

                        if (requisition == null ||
                                        requisition.getId() == null ||
                                        requisition.destinationLocation == null) {
                                throw conflict(
                                                "Purchased material is not linked to a valid requisition destination");
                        }

                        requisition.destinationLocation = (MatFlowLocation) Hibernate.unproxy(
                                        requisition.destinationLocation);

                        /*
                         * Only the still-open project shortage is reserved against the
                         * requisition. Any accepted PO overage stays as free QC stock
                         * and can be used by a later Store review without corrupting
                         * this requisition's requested/reserved quantities.
                         */
                        BigDecimal outstandingDemand = scale(
                                        requisitionLine.shortageQty)
                                        .max(BigDecimal.ZERO);

                        BigDecimal allocatedToDemand = accepted
                                        .min(outstandingDemand)
                                        .setScale(3, RoundingMode.HALF_UP);

                        /*
                         * Indent receivedQty means QC-accepted usable quantity, not
                         * physical GRN receipt. Rejected quantity reopens the effective
                         * ordered balance so Purchase can raise a replacement PO.
                         */
                        BigDecimal indentRemaining = scale(indentLine.requiredQty)
                                        .subtract(scale(indentLine.receivedQty))
                                        .max(BigDecimal.ZERO);

                        BigDecimal acceptedForIndent = accepted
                                        .min(indentRemaining)
                                        .setScale(3, RoundingMode.HALF_UP);

                        indentLine.receivedQty = scale(indentLine.receivedQty)
                                        .add(acceptedForIndent)
                                        .setScale(3, RoundingMode.HALF_UP);

                        indentLine.orderedQty = scale(indentLine.orderedQty)
                                        .subtract(rejected)
                                        .max(indentLine.receivedQty)
                                        .setScale(3, RoundingMode.HALF_UP);

                        indentLine.setUpdatedBy(actor);
                        indentLineRepository.save(indentLine);
                        refreshIndentStatus(indentLine.indent, actor);

                        refreshGoodsReceiptStatus(
                                        receiptLine.goodsReceipt,
                                        actor);

                        if (allocatedToDemand.compareTo(BigDecimal.ZERO) <= 0) {
                                requisitionService.refreshState(
                                                requisition.getId(),
                                                actor);
                                return BigDecimal.ZERO;
                        }

                        MatFlowReservation reservation = new MatFlowReservation();
                        reservation.requisitionLine = requisitionLine;
                        reservation.material = inspection.material;
                        reservation.sourceLocation = inspection.location;
                        reservation.firstDestinationLocation = inspection.location;
                        reservation.demandPlantCode = requisition.destinationLocation.getPlantCode();
                        reservation.reservedQty = allocatedToDemand;
                        reservation.status = ReservationStatus.ACTIVE;
                        reservation.routeSnapshotJson = "[]";
                        reservation.setCreatedBy(actor);
                        reservation.setUpdatedBy(actor);
                        reservation = reservationRepository.save(reservation);

                        requisitionLine.reservedQty = scale(
                                        requisitionLine.reservedQty)
                                        .add(allocatedToDemand)
                                        .setScale(3, RoundingMode.HALF_UP);

                        requisitionLine.shortageQty = outstandingDemand
                                        .subtract(allocatedToDemand)
                                        .max(BigDecimal.ZERO)
                                        .setScale(3, RoundingMode.HALF_UP);

                        requisitionLine.setUpdatedBy(actor);
                        requisitionLineRepository.save(requisitionLine);

                        /*
                         * Do not create Processing/Production transfers here.
                         * The accepted quantity is deliberately parked as reserved QC
                         * stock until the QC actor chooses the physical next hop.
                         */
                        inspection.routingReservationId = reservation.getId();

                        requisitionService.refreshState(
                                        requisition.getId(),
                                        actor);

                        return allocatedToDemand;
                }

                /**
                 * Completes the quality portion of an incoming Store -> QC transfer.
                 *
                 * IMPORTANT: this method deliberately does NOT activate a downstream
                 * Processing/Production transfer. The accepted reservation stays at QC
                 * and the explicit route(...) action is the only authority that may
                 * choose the next department.
                 */
                private BigDecimal completeTransferQc(
                                MatFlowQcInspection inspection,
                                BigDecimal accepted,
                                BigDecimal rejected,
                                String actor) {

                        if (inspection == null ||
                                        inspection.sourceLineId == null ||
                                        inspection.material == null ||
                                        inspection.location == null) {
                                throw conflict("Transfer-receipt QC inspection is incomplete");
                        }

                        MatFlowTransferLine sourceLine = transferLineRepository
                                        .findById(inspection.sourceLineId)
                                        .orElseThrow(() -> notFound("Transfer line not found"));

                        if (sourceLine.transferOrder == null || sourceLine.transferOrder.getId() == null) {
                                throw conflict("QC inspection is not linked to a valid transfer order");
                        }

                        UUID sourceTransferId = sourceLine.transferOrder.getId();
                        MatFlowTransferOrder sourceTransfer = (MatFlowTransferOrder) Hibernate.unproxy(
                                        transferRepository.lockById(sourceTransferId)
                                                        .orElseThrow(() -> notFound("Source transfer not found")));

                        if (inspection.sourceId != null && !inspection.sourceId.equals(sourceTransfer.getId())) {
                                throw conflict("QC inspection source does not match its transfer order");
                        }

                        if (sourceLine.material == null ||
                                        !sourceLine.material.getId().equals(inspection.material.getId())) {
                                throw conflict("QC inspection material does not match the source transfer line");
                        }

                        if (sourceTransfer.toLocation == null ||
                                        !sourceTransfer.toLocation.getId().equals(inspection.location.getId())) {
                                throw conflict("QC inspection location does not match the transfer destination");
                        }

                        BigDecimal plannedQty = scale(sourceLine.plannedQty);
                        BigDecimal dispatchedQty = scale(sourceLine.dispatchedQty);
                        BigDecimal receivedQty = scale(sourceLine.receivedQty);

                        boolean quantitiesFullyReceived = plannedQty.compareTo(BigDecimal.ZERO) > 0 &&
                                        dispatchedQty.compareTo(plannedQty) >= 0 &&
                                        receivedQty.compareTo(plannedQty) >= 0;

                        if (!quantitiesFullyReceived || sourceTransfer.status != TransferStatus.RECEIVED) {
                                throw conflict(
                                                "Transfer must be completely received before QC decision. " +
                                                                "Persisted status=" + sourceTransfer.status +
                                                                ", planned=" + plannedQty.toPlainString() +
                                                                ", dispatched=" + dispatchedQty.toPlainString() +
                                                                ", received=" + receivedQty.toPlainString());
                        }

                        if (sourceTransfer.reservation == null || sourceTransfer.reservation.getId() == null) {
                                throw conflict("Source transfer has no reservation");
                        }

                        MatFlowReservation reservation = (MatFlowReservation) Hibernate.unproxy(
                                        reservationRepository.findById(sourceTransfer.reservation.getId())
                                                        .orElseThrow(() -> notFound("Transfer reservation not found")));

                        if (reservation.requisitionLine == null || reservation.requisitionLine.getId() == null) {
                                throw conflict("Transfer reservation has no requisition line");
                        }

                        MatFlowRequisitionLine requisitionLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                        requisitionLineRepository.findById(reservation.requisitionLine.getId())
                                                        .orElseThrow(() -> notFound("Requisition line not found")));

                        if (requisitionLine.requisition == null || requisitionLine.requisition.getId() == null) {
                                throw conflict("Requisition line has no requisition");
                        }

                        UUID requisitionId = requisitionLine.requisition.getId();

                        reservation.sourceLocation = inspection.location;
                        reservation.reservedQty = scale(accepted);
                        reservation.status = accepted.compareTo(BigDecimal.ZERO) > 0
                                        ? ReservationStatus.ACTIVE
                                        : ReservationStatus.CANCELLED;
                        reservation.setUpdatedBy(actor);
                        reservation = reservationRepository.save(reservation);

                        inspection.routingReservationId = accepted.compareTo(BigDecimal.ZERO) > 0
                                        ? reservation.getId()
                                        : null;

                        if (rejected.compareTo(BigDecimal.ZERO) > 0) {
                                requisitionLine.reservedQty = scale(requisitionLine.reservedQty)
                                                .subtract(rejected)
                                                .max(BigDecimal.ZERO)
                                                .setScale(3, RoundingMode.HALF_UP);
                                requisitionLine.shortageQty = scale(requisitionLine.shortageQty)
                                                .add(rejected)
                                                .setScale(3, RoundingMode.HALF_UP);
                        }

                        requisitionLine.setUpdatedBy(actor);
                        requisitionLineRepository.save(requisitionLine);

                        /*
                         * Compatibility cleanup for data produced by the previous
                         * mandatory-route implementation. Any unexecuted successor is
                         * frozen/cancelled here; route(...) will construct the selected
                         * path after the QC actor makes the explicit decision.
                         */
                        List<MatFlowTransferOrder> existing = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId());

                        for (MatFlowTransferOrder candidate : existing) {
                                if (candidate == null || candidate.getId() == null ||
                                                candidate.getId().equals(sourceTransfer.getId())) {
                                        continue;
                                }
                                MatFlowTransferLine line = transferLineRepository
                                                .findFirstByTransferOrder_IdOrderByCreatedAtAsc(candidate.getId())
                                                .orElse(null);
                                if (line == null)
                                        continue;
                                if (scale(line.dispatchedQty).compareTo(BigDecimal.ZERO) > 0 ||
                                                scale(line.receivedQty).compareTo(BigDecimal.ZERO) > 0) {
                                        throw conflict(
                                                        "A downstream transfer already has physical execution. " +
                                                                        "Resolve transfer " + candidate.transferNumber +
                                                                        " before changing the QC routing model.");
                                }
                                candidate.status = TransferStatus.CANCELLED;
                                candidate.setUpdatedBy(actor);
                                transferRepository.save(candidate);
                        }

                        requisitionService.refreshState(requisitionId, actor);
                        return scale(accepted);
                }

                private void refreshIndentStatus(
                                MatFlowIndent indent,
                                String actor) {
                        if (indent == null) {
                                return;
                        }

                        List<MatFlowIndentLine> lines = indentLineRepository
                                        .findByIndent_IdOrderByCreatedAtAsc(indent.getId());

                        boolean allAccepted = !lines.isEmpty() && lines.stream()
                                        .allMatch(line -> scale(line.receivedQty)
                                                        .compareTo(scale(line.requiredQty)) >= 0);

                        boolean anyAccepted = lines.stream()
                                        .anyMatch(line -> scale(line.receivedQty)
                                                        .compareTo(BigDecimal.ZERO) > 0);

                        boolean anyEffectiveOrder = lines.stream()
                                        .anyMatch(line -> scale(line.orderedQty)
                                                        .compareTo(BigDecimal.ZERO) > 0);

                        if (allAccepted) {
                                indent.status = IndentStatus.RECEIVED;
                        } else if (anyAccepted) {
                                indent.status = IndentStatus.PARTIALLY_RECEIVED;
                        } else if (anyEffectiveOrder) {
                                indent.status = IndentStatus.PURCHASE_IN_PROGRESS;
                        } else {
                                indent.status = IndentStatus.SUBMITTED_TO_PURCHASE;
                        }

                        indent.setUpdatedBy(actor);
                        indentRepository.save(indent);
                }

                @Transactional(readOnly = true)
                public List<QcRoutingResponse> listRouting() {
                        accessService.requireRead();

                        return qcRepository.findAllByOrderByCreatedAtDesc().stream()
                                        .filter(inspection -> inspection != null && inspection.location != null)
                                        .filter(inspection -> accessService.canAccessPlant(
                                                        inspection.location.getPlantCode()))
                                        .filter(inspection -> inspection.status == QcInspectionStatus.COMPLETED)
                                        .filter(inspection -> scale(inspection.acceptedQty)
                                                        .compareTo(BigDecimal.ZERO) > 0)
                                        .filter(inspection -> inspection.routingReservationId != null ||
                                                        inspection.routingDecision != null)
                                        .map(this::toRoutingResponse)
                                        .toList();
                }

                @Transactional(readOnly = true)
                public QcRoutingResponse routing(UUID inspectionId) {
                        accessService.requireRead();
                        return toRoutingResponse(requireInspection(inspectionId));
                }

                /**
                 * The post-QC physical routing gate.
                 *
                 * DIRECT_TO_PRODUCTION creates QC -> Production.
                 * SEND_TO_PROCESSING creates QC -> selected approved Processing
                 * candidate -> Production. Processing is therefore a per-lot QC
                 * decision rather than a mandatory BOM execution step.
                 */
                @Transactional
                public QcRoutingResponse route(
                                UUID inspectionId,
                                QcRoutingRequest request) {
                        accessService.requireQcWrite();

                        if (request == null || request.routingDecision() == null) {
                                throw badRequest("QC routing decision is required");
                        }

                        MatFlowQcInspection inspection = requireInspection(inspectionId);

                        if (inspection.status != QcInspectionStatus.COMPLETED) {
                                throw conflict("Complete the QC inspection before deciding the material route");
                        }

                        if (scale(inspection.acceptedQty).compareTo(BigDecimal.ZERO) <= 0) {
                                throw conflict("This QC inspection has no accepted quantity to route");
                        }

                        if (inspection.routingReservationId == null) {
                                throw conflict(
                                                "Accepted QC quantity is not allocated to an active Project/Product requisition. "
                                                                +
                                                                "Free/unallocated QC stock does not require a project route decision.");
                        }

                        if (inspection.routingDecision != null) {
                                throw conflict(
                                                "QC routing is already decided as " + inspection.routingDecision +
                                                                ". Physical route decisions are immutable after release.");
                        }

                        assertVersion(request.rowVersion(), inspection.getRowVersion());

                        MatFlowReservation reservation = (MatFlowReservation) Hibernate.unproxy(
                                        reservationRepository.findById(inspection.routingReservationId)
                                                        .orElseThrow(() -> conflict(
                                                                        "QC routing reservation no longer exists")));

                        if (reservation.status != ReservationStatus.ACTIVE ||
                                        scale(reservation.reservedQty).compareTo(BigDecimal.ZERO) <= 0) {
                                throw conflict("QC routing reservation is no longer active");
                        }

                        if (reservation.requisitionLine == null || reservation.requisitionLine.getId() == null) {
                                throw conflict("QC routing reservation has no requisition line");
                        }

                        MatFlowRequisitionLine requisitionLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                        requisitionLineRepository.findById(reservation.requisitionLine.getId())
                                                        .orElseThrow(() -> conflict(
                                                                        "QC requisition line no longer exists")));

                        if (requisitionLine.requisition == null || requisitionLine.requisition.getId() == null) {
                                throw conflict("QC requisition line has no requisition");
                        }

                        MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(
                                        requisitionLine.requisition);

                        if (requisition.destinationLocation == null) {
                                throw conflict("Requisition Production destination is missing");
                        }

                        /*
                         * Requisition is the immutable execution header and therefore owns
                         * the exact Production destination selected when demand was raised.
                         * Unwrap the location before reading its operational type; MatFlow
                         * entities expose public JPA fields and may already be represented
                         * by Hibernate proxies in the current persistence context.
                         */
                        MatFlowLocation productionDestination = (MatFlowLocation) Hibernate.unproxy(
                                        requisition.destinationLocation);
                        requisition.destinationLocation = productionDestination;

                        if (productionDestination.getLocationType() != LocationType.PRODUCTION) {
                                throw conflict(
                                                "Requisition destination is no longer a valid Production location");
                        }

                        accessService.requirePlantAccess(
                                        productionDestination.getPlantCode());

                        if (requisitionLine.bomLine == null || requisitionLine.bomLine.getId() == null) {
                                throw conflict("Requisition line is not linked to its approved BOM material line");
                        }

                        /*
                         * Always hydrate the approved route before inspecting public
                         * backing fields such as stepType/location. This fixes the same
                         * Hibernate proxy/public-field hazard already handled elsewhere
                         * in MatFlow.
                         */
                        List<MatFlowBomRouteStep> route = hydrateApprovedRoute(
                                        requisitionLine.bomLine.getId());

                        /*
                         * The BOM intentionally contains only optional PROCESSING choices.
                         * Store decides whether QC is required, and the MR owns the exact
                         * Production destination. Therefore QC never searches the BOM for
                         * a QC or Production route step.
                         */
                        final UUID productionRouteStepId = null;

                        MatFlowBomRouteStep processingStep = null;

                        if (request.routingDecision() == QcRoutingDecision.SEND_TO_PROCESSING) {
                                if (request.processingRouteStepId() == null) {
                                        throw badRequest("Select the approved Processing Unit for this QC lot");
                                }

                                processingStep = route.stream()
                                                .filter(step -> step.stepType == RouteStepType.PROCESSING &&
                                                                request.processingRouteStepId().equals(step.getId()))
                                                .findFirst()
                                                .orElseThrow(() -> badRequest(
                                                                "Selected Processing Unit is not an approved Processing option for this BOM material"));

                                if (processingStep.location == null ||
                                                (processingStep.location.getLocationType() != LocationType.PROCESSING &&
                                                                processingStep.location
                                                                                .getLocationType() != LocationType.EXTERNAL_PROCESSOR)) {
                                        throw conflict("Selected BOM Processing step has no valid Processing Unit");
                                }
                        } else if (request.processingRouteStepId() != null) {
                                throw badRequest(
                                                "Processing route step must be empty when QC chooses Direct to Production");
                        }

                        String actor = accessService.actor();

                        MatFlowTransferOrder sourceTransfer = null;
                        if (inspection.sourceType == QcSourceType.TRANSFER_RECEIPT && inspection.sourceId != null) {
                                sourceTransfer = (MatFlowTransferOrder) Hibernate.unproxy(
                                                transferRepository.findById(inspection.sourceId)
                                                                .orElseThrow(() -> conflict(
                                                                                "QC source transfer no longer exists")));
                                if (sourceTransfer.status != TransferStatus.RECEIVED) {
                                        throw conflict("QC source transfer must remain Received before route release");
                                }
                        }

                        cancelUnexecutedDownstreamTransfers(
                                        reservation,
                                        sourceTransfer == null ? null : sourceTransfer.getId(),
                                        actor);

                        boolean deferInitialTransfer = scale(requisitionLine.shortageQty)
                                        .compareTo(BigDecimal.ZERO) > 0 &&
                                        requisition.partialAvailabilityDecision != PartialAvailabilityDecision.ISSUE_AVAILABLE_NOW;

                        UUID predecessorId = sourceTransfer == null ? null : sourceTransfer.getId();
                        int sequence = sourceTransfer == null || sourceTransfer.routeSequenceNo == null
                                        ? 10
                                        : sourceTransfer.routeSequenceNo + 10;

                        MatFlowLocation current = inspection.location == null
                                        ? null
                                        : (MatFlowLocation) Hibernate.unproxy(inspection.location);

                        if (current == null || current.getId() == null) {
                                throw conflict("QC inspection has no valid current custody location");
                        }

                        inspection.location = current;

                        boolean alreadyAtProduction = current.getId()
                                        .equals(productionDestination.getId());

                        /*
                         * Normal QC routing must start from a QC custody location.
                         * Historical purchased lots created while legacy empty routes
                         * were still accepted can already be physically recorded at the
                         * exact Production destination. Those rows may only be completed
                         * as Direct-to-Production; creating a fake Production->Production
                         * transfer would corrupt movement history.
                         */
                        if (!alreadyAtProduction &&
                                        current.getLocationType() != LocationType.QC) {
                                throw conflict(
                                                "Material is not currently at a QC location. Current custody: "
                                                                + current.getLocationCode());
                        }

                        if (alreadyAtProduction &&
                                        request.routingDecision() == QcRoutingDecision.SEND_TO_PROCESSING) {
                                throw conflict(
                                                "This historical lot is already recorded at its Production destination. "
                                                                +
                                                                "It can only be confirmed Direct to Production; do not create a backward Production-to-Processing movement.");
                        }

                        MatFlowTransferOrder firstCreated = null;

                        if (request.routingDecision() == QcRoutingDecision.SEND_TO_PROCESSING) {
                                firstCreated = createQcRouteTransfer(
                                                requisition,
                                                reservation,
                                                current,
                                                processingStep.location,
                                                processingStep.getId(),
                                                predecessorId,
                                                sequence,
                                                scale(reservation.reservedQty),
                                                deferInitialTransfer,
                                                "QC routed accepted material to Processing",
                                                actor);

                                createQcRouteTransfer(
                                                requisition,
                                                reservation,
                                                processingStep.location,
                                                productionDestination,
                                                productionRouteStepId,
                                                firstCreated.getId(),
                                                sequence + 10,
                                                scale(reservation.reservedQty),
                                                true,
                                                "Production hand-off planned after selected Processing Unit to the MR Production destination",
                                                actor);
                        } else if (!alreadyAtProduction) {
                                firstCreated = createQcRouteTransfer(
                                                requisition,
                                                reservation,
                                                current,
                                                productionDestination,
                                                productionRouteStepId,
                                                predecessorId,
                                                sequence,
                                                scale(reservation.reservedQty),
                                                deferInitialTransfer,
                                                "QC routed accepted material directly to the MR Production destination",
                                                actor);
                        }

                        inspection.routingDecision = request.routingDecision();
                        inspection.processingRouteStepId = processingStep == null ? null : processingStep.getId();
                        inspection.routingDecidedBy = actor;
                        inspection.routingDecidedAt = LocalDateTime.now();
                        inspection.routingRemarks = clean(request.remarks());
                        inspection.setUpdatedBy(actor);
                        inspection = qcRepository.save(inspection);

                        auditService.record(
                                        "QC_INSPECTION",
                                        inspection.getId(),
                                        "QC_ROUTE_DECIDED",
                                        inspection.location.getPlantCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "requisitionNumber", requisition.requisitionNumber,
                                                        "routingDecision", inspection.routingDecision,
                                                        "processingRouteStepId", inspection.processingRouteStepId,
                                                        "fromLocation", inspection.location.getLocationCode(),
                                                        "productionDestination",
                                                        productionDestination.getLocationCode(),
                                                        "productionRouteSource",
                                                        "REQUISITION_DESTINATION",
                                                        "alreadyAtProduction", alreadyAtProduction,
                                                        "nextTransferId",
                                                        firstCreated == null ? null : firstCreated.getId(),
                                                        "nextTransferNumber",
                                                        firstCreated == null ? null : firstCreated.transferNumber,
                                                        "acceptedQty", inspection.acceptedQty));

                        requisitionService.refreshState(requisition.getId(), actor);
                        return toRoutingResponse(inspection);
                }

                private void cancelUnexecutedDownstreamTransfers(
                                MatFlowReservation reservation,
                                UUID sourceTransferId,
                                String actor) {
                        List<MatFlowTransferOrder> transfers = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId());

                        for (MatFlowTransferOrder transfer : transfers) {
                                if (transfer == null || transfer.getId() == null ||
                                                transfer.getId().equals(sourceTransferId)) {
                                        continue;
                                }

                                MatFlowTransferLine line = transferLineRepository
                                                .findFirstByTransferOrder_IdOrderByCreatedAtAsc(transfer.getId())
                                                .orElse(null);
                                if (line == null)
                                        continue;

                                boolean executed = scale(line.dispatchedQty).compareTo(BigDecimal.ZERO) > 0 ||
                                                scale(line.receivedQty).compareTo(BigDecimal.ZERO) > 0;

                                if (executed && transfer.status != TransferStatus.CANCELLED) {
                                        throw conflict(
                                                        "Existing downstream transfer " + transfer.transferNumber +
                                                                        " already has physical movement and cannot be replaced by a new QC route decision");
                                }

                                if (!executed && transfer.status != TransferStatus.CANCELLED) {
                                        transfer.status = TransferStatus.CANCELLED;
                                        transfer.setUpdatedBy(actor);
                                        transferRepository.save(transfer);
                                }
                        }
                }

                private MatFlowTransferOrder createQcRouteTransfer(
                                MatFlowMaterialRequisition requisition,
                                MatFlowReservation reservation,
                                MatFlowLocation from,
                                MatFlowLocation to,
                                UUID routeStepId,
                                UUID predecessorId,
                                int sequence,
                                BigDecimal quantity,
                                boolean defer,
                                String remarks,
                                String actor) {
                        if (from == null || to == null) {
                                throw conflict("QC route source and destination are required");
                        }
                        if (from.getId().equals(to.getId())) {
                                throw conflict("QC route cannot transfer material to the same location");
                        }

                        MatFlowTransferOrder transfer = new MatFlowTransferOrder();
                        transfer.transferNumber = generateNumber("MFT");
                        transfer.requisition = requisition;
                        transfer.reservation = reservation;
                        transfer.fromLocation = from;
                        transfer.toLocation = to;
                        transfer.routeSequenceNo = sequence;
                        transfer.predecessorTransferId = predecessorId;
                        transfer.purpose = determinePurpose(from, to);
                        transfer.status = predecessorId == null && !defer
                                        ? TransferStatus.READY
                                        : predecessorId != null && !defer &&
                                                        inspectionPredecessorAlreadyReceived(predecessorId)
                                                                        ? TransferStatus.READY
                                                                        : TransferStatus.PLANNED;
                        transfer.remarks = remarks;
                        transfer.setCreatedBy(actor);
                        transfer.setUpdatedBy(actor);
                        transfer = transferRepository.save(transfer);

                        MatFlowTransferLine line = new MatFlowTransferLine();
                        line.transferOrder = transfer;
                        line.material = reservation.material;
                        line.routeStepId = routeStepId;
                        line.plannedQty = scale(quantity);
                        line.dispatchedQty = BigDecimal.ZERO;
                        line.receivedQty = BigDecimal.ZERO;
                        line.uom = reservation.material.getUom();
                        line.setCreatedBy(actor);
                        line.setUpdatedBy(actor);
                        transferLineRepository.save(line);

                        return transfer;
                }

                private boolean inspectionPredecessorAlreadyReceived(UUID predecessorId) {
                        if (predecessorId == null)
                                return true;
                        return transferRepository.findById(predecessorId)
                                        .map(transfer -> transfer.status == TransferStatus.RECEIVED)
                                        .orElse(false);
                }

                /**
                 * Loads the authoritative BOM route and unwraps every route entity
                 * before callers inspect public JPA backing fields.
                 *
                 * Repository query results can reuse an already managed Hibernate
                 * proxy from the persistence context. In MatFlow, direct public-field
                 * access (for example step.stepType) bypasses proxy getter
                 * interception and can therefore look null even when the database row
                 * is valid.
                 */
                private List<MatFlowBomRouteStep> hydrateApprovedRoute(
                                UUID bomLineId) {
                        if (bomLineId == null) {
                                return List.of();
                        }

                        List<MatFlowBomRouteStep> rawRoute = routingService.routeForLine(
                                        bomLineId);

                        if (rawRoute == null || rawRoute.isEmpty()) {
                                return List.of();
                        }

                        return rawRoute.stream()
                                        .filter(step -> step != null)
                                        .map(step -> {
                                                MatFlowBomRouteStep hydrated = (MatFlowBomRouteStep) Hibernate.unproxy(
                                                                step);

                                                if (hydrated.location != null) {
                                                        hydrated.location = (MatFlowLocation) Hibernate.unproxy(
                                                                        hydrated.location);
                                                }

                                                if (hydrated.bomLine != null) {
                                                        hydrated.bomLine = (MatFlowBomLine) Hibernate.unproxy(
                                                                        hydrated.bomLine);
                                                }

                                                return hydrated;
                                        })
                                        .toList();
                }

                private QcBusinessContext resolveBusinessContext(MatFlowQcInspection inspection) {
                        MatFlowRequisitionLine requisitionLine = null;
                        MatFlowMaterialRequisition requisition = null;
                        MatFlowIndent directIndent = null;
                        MatFlowPurchaseOrder directOrder = null;
                        MatFlowGoodsReceipt directReceipt = null;

                        if (inspection != null && inspection.sourceType == QcSourceType.GOODS_RECEIPT
                                        && inspection.sourceLineId != null) {
                                MatFlowGoodsReceiptLine receiptLine = receiptLineRepository
                                                .findById(inspection.sourceLineId)
                                                .map(this::hydrateGoodsReceiptLine)
                                                .orElse(null);

                                if (receiptLine != null) {
                                        directReceipt = receiptLine.goodsReceipt;

                                        if (receiptLine.purchaseOrderLine != null) {
                                                MatFlowPurchaseOrderLine poLine = (MatFlowPurchaseOrderLine) Hibernate
                                                                .unproxy(receiptLine.purchaseOrderLine);

                                                if (poLine.purchaseOrder != null) {
                                                        directOrder = (MatFlowPurchaseOrder) Hibernate
                                                                        .unproxy(poLine.purchaseOrder);
                                                }

                                                if (poLine.indentLine != null) {
                                                        MatFlowIndentLine indentLine = (MatFlowIndentLine) Hibernate
                                                                        .unproxy(poLine.indentLine);

                                                        if (indentLine.indent != null) {
                                                                directIndent = (MatFlowIndent) Hibernate
                                                                                .unproxy(indentLine.indent);
                                                        }

                                                        if (indentLine.requisitionLine != null
                                                                        && indentLine.requisitionLine.getId() != null) {
                                                                requisitionLine = requisitionLineRepository
                                                                                .findById(indentLine.requisitionLine
                                                                                                .getId())
                                                                                .map(value -> (MatFlowRequisitionLine) Hibernate
                                                                                                .unproxy(value))
                                                                                .orElse((MatFlowRequisitionLine) Hibernate
                                                                                                .unproxy(indentLine.requisitionLine));
                                                        }
                                                }
                                        }

                                        if (directOrder == null && directReceipt != null
                                                        && directReceipt.purchaseOrder != null) {
                                                directOrder = (MatFlowPurchaseOrder) Hibernate
                                                                .unproxy(directReceipt.purchaseOrder);
                                        }

                                        if (directIndent == null && directOrder != null && directOrder.indent != null) {
                                                directIndent = (MatFlowIndent) Hibernate.unproxy(directOrder.indent);
                                        }
                                }
                        }

                        if (inspection != null && inspection.sourceType == QcSourceType.TRANSFER_RECEIPT) {
                                MatFlowTransferOrder sourceTransfer = null;

                                if (inspection.sourceId != null) {
                                        sourceTransfer = transferRepository.findById(inspection.sourceId)
                                                        .map(value -> (MatFlowTransferOrder) Hibernate.unproxy(value))
                                                        .orElse(null);
                                }

                                if (sourceTransfer == null && inspection.sourceLineId != null) {
                                        MatFlowTransferLine sourceLine = transferLineRepository
                                                        .findById(inspection.sourceLineId)
                                                        .map(value -> (MatFlowTransferLine) Hibernate.unproxy(value))
                                                        .orElse(null);
                                        if (sourceLine != null && sourceLine.transferOrder != null) {
                                                sourceTransfer = (MatFlowTransferOrder) Hibernate
                                                                .unproxy(sourceLine.transferOrder);
                                        }
                                }

                                if (sourceTransfer != null) {
                                        if (sourceTransfer.reservation != null
                                                        && sourceTransfer.reservation.getId() != null) {
                                                MatFlowReservation reservation = reservationRepository
                                                                .findById(sourceTransfer.reservation.getId())
                                                                .map(value -> (MatFlowReservation) Hibernate
                                                                                .unproxy(value))
                                                                .orElse(null);

                                                if (reservation != null && reservation.requisitionLine != null
                                                                && reservation.requisitionLine.getId() != null) {
                                                        requisitionLine = requisitionLineRepository
                                                                        .findById(reservation.requisitionLine.getId())
                                                                        .map(value -> (MatFlowRequisitionLine) Hibernate
                                                                                        .unproxy(value))
                                                                        .orElse(null);
                                                }
                                        }

                                        if (sourceTransfer.requisition != null) {
                                                requisition = (MatFlowMaterialRequisition) Hibernate
                                                                .unproxy(sourceTransfer.requisition);
                                        }
                                }
                        }

                        if (requisitionLine != null && requisitionLine.requisition != null) {
                                requisition = (MatFlowMaterialRequisition) Hibernate
                                                .unproxy(requisitionLine.requisition);
                        }

                        if (requisition == null && directIndent != null && directIndent.requisition != null) {
                                requisition = (MatFlowMaterialRequisition) Hibernate
                                                .unproxy(directIndent.requisition);
                        }

                        if (inspection != null && inspection.routingReservationId != null) {
                                MatFlowReservation routingReservation = reservationRepository
                                                .findById(inspection.routingReservationId)
                                                .map(value -> (MatFlowReservation) Hibernate.unproxy(value))
                                                .orElse(null);
                                if (routingReservation != null && routingReservation.requisitionLine != null
                                                && routingReservation.requisitionLine.getId() != null) {
                                        requisitionLine = requisitionLineRepository
                                                        .findById(routingReservation.requisitionLine.getId())
                                                        .map(value -> (MatFlowRequisitionLine) Hibernate.unproxy(value))
                                                        .orElse(requisitionLine);
                                }
                                if (requisitionLine != null && requisitionLine.requisition != null) {
                                        requisition = (MatFlowMaterialRequisition) Hibernate
                                                        .unproxy(requisitionLine.requisition);
                                } else if (requisition == null) {
                                        requisition = resolveRoutingRequisition(inspection.routingReservationId);
                                }
                        }

                        List<MatFlowIndent> relatedIndents = new ArrayList<>();
                        if (directIndent != null) {
                                relatedIndents.add(directIndent);
                        }

                        final UUID targetRequisitionLineId = requisitionLine == null
                                        ? null
                                        : requisitionLine.getId();

                        if (requisition != null && requisition.getId() != null) {
                                for (MatFlowIndent indent : indentRepository
                                                .findByRequisition_IdOrderByCreatedAtAsc(requisition.getId())) {
                                        if (indent == null || indent.getId() == null) {
                                                continue;
                                        }

                                        boolean matchesLine = targetRequisitionLineId == null
                                                        || indentLineRepository
                                                                        .findByIndent_IdOrderByCreatedAtAsc(
                                                                                        indent.getId())
                                                                        .stream()
                                                                        .anyMatch(line -> line != null
                                                                                        && line.requisitionLine != null
                                                                                        && targetRequisitionLineId
                                                                                                        .equals(
                                                                                                                        line.requisitionLine
                                                                                                                                        .getId()));

                                        if (matchesLine && relatedIndents.stream()
                                                        .noneMatch(existing -> existing.getId()
                                                                        .equals(indent.getId()))) {
                                                relatedIndents.add(indent);
                                        }
                                }
                        }

                        LinkedHashSet<String> indentNumbers = new LinkedHashSet<>();
                        LinkedHashSet<UUID> indentIds = new LinkedHashSet<>();
                        for (MatFlowIndent indent : relatedIndents) {
                                if (indent == null) {
                                        continue;
                                }
                                if (indent.getId() != null) {
                                        indentIds.add(indent.getId());
                                }
                                String number = clean(indent.indentNumber);
                                if (number != null) {
                                        indentNumbers.add(number);
                                }
                        }

                        LinkedHashSet<MatFlowPurchaseOrder> orders = new LinkedHashSet<>();
                        if (directOrder != null) {
                                orders.add(directOrder);
                        }
                        for (UUID indentId : indentIds) {
                                purchaseOrderRepository.findByIndent_Id(indentId).stream()
                                                .filter(java.util.Objects::nonNull)
                                                .map(order -> (MatFlowPurchaseOrder) Hibernate.unproxy(order))
                                                .forEach(orders::add);
                        }

                        LinkedHashSet<String> purchaseOrderNumbers = new LinkedHashSet<>();
                        LinkedHashSet<MatFlowGoodsReceipt> receipts = new LinkedHashSet<>();
                        if (directReceipt != null) {
                                receipts.add(directReceipt);
                        }

                        for (MatFlowPurchaseOrder order : orders) {
                                if (order == null) {
                                        continue;
                                }
                                String number = clean(order.poNumber);
                                if (number != null) {
                                        purchaseOrderNumbers.add(number);
                                }
                                if (order.getId() != null) {
                                        receiptRepository.findByPurchaseOrder_IdOrderByReceivedAtAsc(order.getId())
                                                        .stream()
                                                        .filter(java.util.Objects::nonNull)
                                                        .map(receipt -> (MatFlowGoodsReceipt) Hibernate
                                                                        .unproxy(receipt))
                                                        .forEach(receipts::add);
                                }
                        }

                        LinkedHashSet<String> grnNumbers = new LinkedHashSet<>();
                        for (MatFlowGoodsReceipt receipt : receipts) {
                                String number = receipt == null ? null : clean(receipt.grnNumber);
                                if (number != null) {
                                        grnNumbers.add(number);
                                }
                        }

                        return new QcBusinessContext(
                                        requisition,
                                        requisition == null ? null : requisition.requisitionNumber,
                                        List.copyOf(indentNumbers),
                                        List.copyOf(purchaseOrderNumbers),
                                        List.copyOf(grnNumbers));
                }

                private record QcBusinessContext(
                                MatFlowMaterialRequisition requisition,
                                String requisitionNumber,
                                List<String> indentNumbers,
                                List<String> purchaseOrderNumbers,
                                List<String> grnNumbers) {
                        String primaryReferenceNumber() {
                                if (requisitionNumber != null && !requisitionNumber.isBlank()) {
                                        return requisitionNumber;
                                }
                                if (!grnNumbers.isEmpty()) {
                                        return grnNumbers.get(grnNumbers.size() - 1);
                                }
                                if (!purchaseOrderNumbers.isEmpty()) {
                                        return purchaseOrderNumbers.get(purchaseOrderNumbers.size() - 1);
                                }
                                if (!indentNumbers.isEmpty()) {
                                        return indentNumbers.get(indentNumbers.size() - 1);
                                }
                                return null;
                        }
                }

                private MatFlowMaterialRequisition resolveRoutingRequisition(UUID reservationId) {
                        if (reservationId == null)
                                return null;
                        MatFlowReservation reservation = reservationRepository.findById(reservationId)
                                        .map(value -> (MatFlowReservation) Hibernate.unproxy(value))
                                        .orElse(null);
                        if (reservation == null || reservation.requisitionLine == null)
                                return null;
                        MatFlowRequisitionLine line = reservation.requisitionLine;
                        if (line.getId() != null) {
                                line = requisitionLineRepository.findById(line.getId())
                                                .map(value -> (MatFlowRequisitionLine) Hibernate.unproxy(value))
                                                .orElse(line);
                        }
                        return line.requisition == null
                                        ? null
                                        : (MatFlowMaterialRequisition) Hibernate.unproxy(line.requisition);
                }

                private QcRoutingResponse toRoutingResponse(MatFlowQcInspection inspection) {
                        if (inspection == null) {
                                throw badRequest("QC inspection is required");
                        }

                        MatFlowReservation reservation = null;
                        MatFlowRequisitionLine requisitionLine = null;
                        MatFlowMaterialRequisition requisition = null;

                        if (inspection.routingReservationId != null) {
                                reservation = reservationRepository.findById(inspection.routingReservationId)
                                                .map(value -> (MatFlowReservation) Hibernate.unproxy(value))
                                                .orElse(null);
                        }

                        if (reservation != null && reservation.requisitionLine != null &&
                                        reservation.requisitionLine.getId() != null) {
                                requisitionLine = requisitionLineRepository
                                                .findById(reservation.requisitionLine.getId())
                                                .map(value -> (MatFlowRequisitionLine) Hibernate.unproxy(value))
                                                .orElse(null);
                        }

                        if (requisitionLine != null && requisitionLine.requisition != null) {
                                requisition = (MatFlowMaterialRequisition) Hibernate
                                                .unproxy(requisitionLine.requisition);
                        }

                        List<MatFlowBomRouteStep> route = requisitionLine == null ||
                                        requisitionLine.bomLine == null || requisitionLine.bomLine.getId() == null
                                                        ? List.of()
                                                        : hydrateApprovedRoute(requisitionLine.bomLine.getId());

                        List<ProcessingRouteOption> options = route.stream()
                                        .filter(step -> step != null && step.stepType == RouteStepType.PROCESSING &&
                                                        step.location != null)
                                        .map(step -> new ProcessingRouteOption(
                                                        step.getId(),
                                                        step.location.getId(),
                                                        step.location.getLocationCode(),
                                                        step.location.getLocationName(),
                                                        step.location.getPlantCode(),
                                                        step.processCode,
                                                        step.sequenceNo))
                                        .toList();

                        MatFlowTransferOrder nextTransfer = reservation == null ? null
                                        : transferRepository
                                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                                                        reservation.getId())
                                                        .stream()
                                                        .filter(transfer -> transfer != null
                                                                        && transfer.status != TransferStatus.CANCELLED)
                                                        .filter(transfer -> inspection.sourceId == null ||
                                                                        !inspection.sourceId.equals(transfer.getId()))
                                                        .filter(transfer -> transfer.fromLocation != null
                                                                        && inspection.location != null &&
                                                                        transfer.fromLocation.getId().equals(
                                                                                        inspection.location.getId()))
                                                        .findFirst()
                                                        .orElse(null);

                        boolean required = inspection.status == QcInspectionStatus.COMPLETED &&
                                        scale(inspection.acceptedQty).compareTo(BigDecimal.ZERO) > 0 &&
                                        inspection.routingReservationId != null;

                        return new QcRoutingResponse(
                                        inspection.getId(),
                                        requisition == null ? null : requisition.getId(),
                                        requisition == null ? null : requisition.requisitionNumber,
                                        inspection.routingReservationId,
                                        required,
                                        required && inspection.routingDecision != null,
                                        inspection.routingDecision,
                                        inspection.processingRouteStepId,
                                        inspection.routingDecidedBy,
                                        inspection.routingDecidedAt,
                                        inspection.routingRemarks,
                                        inspection.location == null ? null : custodyLabel(inspection.location),
                                        inspection.location == null ? null : inspection.location.getPlantCode(),
                                        requisition == null ? null : requisition.requestedBy,
                                        requisition == null || requisition.destinationLocation == null
                                                        ? null
                                                        : requisition.destinationLocation.getPlantCode(),
                                        options,
                                        inspection.getRowVersion());
                }

                private String custodyLabel(MatFlowLocation value) {
                        if (value == null || value.getLocationType() == null) {
                                return null;
                        }
                        return switch (value.getLocationType()) {
                                case STORE -> MatFlowPlantRoutingService.MAIN_STORE_PLANT
                                                .equalsIgnoreCase(value.getPlantCode())
                                                                ? "AL-P1 MAIN STORE"
                                                                : value.getPlantCode() + " STORE";
                                case PRODUCTION -> value.getPlantCode() + " PRODUCTION";
                                case PROCESSING, EXTERNAL_PROCESSOR -> value.getLocationCode();
                                case SUPPLIER -> "SUPPLIER";
                                case TRANSIT -> "IN TRANSIT";
                                case QC -> "QC CHECK";
                        };
                }

                private TransferPurpose determinePurpose(
                                MatFlowLocation from,
                                MatFlowLocation to) {
                        if (from == null || to == null) {
                                throw conflict("Transfer source and destination are required");
                        }

                        if (!from.getPlantCode().equalsIgnoreCase(to.getPlantCode())) {
                                return TransferPurpose.INTER_PLANT;
                        }

                        LocationType fromType = from.getLocationType();
                        LocationType toType = to.getLocationType();

                        if (toType == LocationType.QC) {
                                return TransferPurpose.QC_TRANSFER;
                        }

                        if (fromType == LocationType.QC &&
                                        (toType == LocationType.PROCESSING ||
                                                        toType == LocationType.EXTERNAL_PROCESSOR)) {
                                return TransferPurpose.QC_TO_PROCESSING;
                        }

                        if (fromType == LocationType.QC && toType == LocationType.PRODUCTION) {
                                return TransferPurpose.QC_TO_PRODUCTION;
                        }

                        boolean fromProcessing = fromType == LocationType.PROCESSING ||
                                        fromType == LocationType.EXTERNAL_PROCESSOR;
                        boolean toProcessing = toType == LocationType.PROCESSING ||
                                        toType == LocationType.EXTERNAL_PROCESSOR;

                        if (fromProcessing && toProcessing) {
                                return TransferPurpose.PROCESSING_TO_PROCESSING;
                        }
                        if (fromProcessing && toType == LocationType.PRODUCTION) {
                                return TransferPurpose.PROCESSING_TO_PRODUCTION;
                        }
                        if (toProcessing) {
                                return TransferPurpose.STORE_TO_PROCESSING;
                        }
                        return TransferPurpose.STORE_TO_PRODUCTION;
                }

                private void refreshGoodsReceiptStatus(
                                MatFlowGoodsReceipt rawReceipt,
                                String actor) {
                        if (rawReceipt == null ||
                                        rawReceipt.getId() == null) {
                                return;
                        }

                        MatFlowGoodsReceipt receipt = (MatFlowGoodsReceipt) Hibernate.unproxy(
                                        rawReceipt);

                        List<MatFlowGoodsReceiptLine> lines = receiptLineRepository
                                        .findByGoodsReceipt_IdOrderByCreatedAtAsc(
                                                        receipt.getId())
                                        .stream()
                                        .map(this::hydrateGoodsReceiptLine)
                                        .filter(line -> line != null)
                                        .toList();

                        boolean allInspected = !lines.isEmpty() &&
                                        lines.stream()
                                                        .allMatch(line -> scale(line.acceptedQty)
                                                                        .add(scale(line.rejectedQty))
                                                                        .compareTo(scale(line.receivedQty)) >= 0);

                        if (!allInspected) {
                                receipt.status = GoodsReceiptStatus.QC_PENDING;
                        } else {
                                boolean allAccepted = lines.stream()
                                                .allMatch(line -> scale(line.acceptedQty)
                                                                .compareTo(scale(line.receivedQty)) >= 0);

                                boolean allRejected = lines.stream()
                                                .allMatch(line -> scale(line.rejectedQty)
                                                                .compareTo(scale(line.receivedQty)) >= 0);

                                boolean allRejectedReturned = lines.stream()
                                                .allMatch(line -> scale(line.returnedQty)
                                                                .compareTo(scale(line.rejectedQty)) >= 0);

                                if (allRejectedReturned &&
                                                lines.stream()
                                                                .anyMatch(line -> scale(line.rejectedQty)
                                                                                .compareTo(BigDecimal.ZERO) > 0)) {
                                        receipt.status = GoodsReceiptStatus.CLOSED;
                                } else if (allAccepted) {
                                        receipt.status = GoodsReceiptStatus.ACCEPTED;
                                } else if (allRejected) {
                                        receipt.status = GoodsReceiptStatus.REJECTED;
                                } else {
                                        receipt.status = GoodsReceiptStatus.PARTIALLY_ACCEPTED;
                                }
                        }

                        receipt.setUpdatedBy(actor);

                        receiptRepository.save(receipt);
                }

                /**
                 * Hydrates an inspection before any public JPA backing field is read.
                 * This mirrors the defensive Hibernate proxy handling already used by
                 * the Transfer and Requisition execution paths.
                 */
                private MatFlowQcInspection hydrateInspection(
                                MatFlowQcInspection rawInspection) {
                        if (rawInspection == null) {
                                return null;
                        }

                        MatFlowQcInspection inspection = (MatFlowQcInspection) Hibernate.unproxy(
                                        rawInspection);

                        if (inspection.material != null) {
                                inspection.material = (MatFlowMaterial) Hibernate.unproxy(
                                                inspection.material);
                        }

                        if (inspection.location != null) {
                                inspection.location = (MatFlowLocation) Hibernate.unproxy(
                                                inspection.location);
                        }

                        return inspection;
                }

                /**
                 * Hydrates the complete purchased-material lineage used by QC:
                 *
                 * GRN Line -> PO Line -> Indent Line -> Requisition Line -> Requisition
                 *
                 * MatFlow entities currently expose public JPA fields. Reading a field
                 * directly from a Hibernate proxy can falsely appear null even when the
                 * foreign key is valid. This method makes the authoritative entity state
                 * explicit before QC validates or mutates the purchased shortage branch.
                 */
                private MatFlowGoodsReceiptLine hydrateGoodsReceiptLine(
                                MatFlowGoodsReceiptLine rawLine) {
                        if (rawLine == null) {
                                return null;
                        }

                        MatFlowGoodsReceiptLine line = (MatFlowGoodsReceiptLine) Hibernate.unproxy(
                                        rawLine);

                        if (line.material != null) {
                                line.material = (MatFlowMaterial) Hibernate.unproxy(
                                                line.material);
                        }

                        if (line.goodsReceipt != null) {
                                MatFlowGoodsReceipt receipt = (MatFlowGoodsReceipt) Hibernate.unproxy(
                                                line.goodsReceipt);

                                if (receipt.receiptLocation != null) {
                                        receipt.receiptLocation = (MatFlowLocation) Hibernate.unproxy(
                                                        receipt.receiptLocation);
                                }

                                if (receipt.purchaseOrder != null) {
                                        MatFlowPurchaseOrder order = (MatFlowPurchaseOrder) Hibernate.unproxy(
                                                        receipt.purchaseOrder);

                                        if (order.vendor != null) {
                                                order.vendor = (MatFlowVendor) Hibernate.unproxy(
                                                                order.vendor);
                                        }

                                        if (order.indent != null) {
                                                order.indent = (MatFlowIndent) Hibernate.unproxy(
                                                                order.indent);
                                        }

                                        if (order.deliveryLocation != null) {
                                                order.deliveryLocation = (MatFlowLocation) Hibernate.unproxy(
                                                                order.deliveryLocation);
                                        }

                                        receipt.purchaseOrder = order;
                                }

                                line.goodsReceipt = receipt;
                        }

                        if (line.purchaseOrderLine != null) {
                                MatFlowPurchaseOrderLine poLine = (MatFlowPurchaseOrderLine) Hibernate.unproxy(
                                                line.purchaseOrderLine);

                                if (poLine.material != null) {
                                        poLine.material = (MatFlowMaterial) Hibernate.unproxy(
                                                        poLine.material);
                                }

                                if (poLine.purchaseOrder != null) {
                                        poLine.purchaseOrder = (MatFlowPurchaseOrder) Hibernate.unproxy(
                                                        poLine.purchaseOrder);
                                }

                                if (poLine.indentLine != null) {
                                        MatFlowIndentLine indentLine = (MatFlowIndentLine) Hibernate.unproxy(
                                                        poLine.indentLine);

                                        if (indentLine.indent != null) {
                                                indentLine.indent = (MatFlowIndent) Hibernate.unproxy(
                                                                indentLine.indent);

                                                if (indentLine.indent.requisition != null) {
                                                        indentLine.indent.requisition = (MatFlowMaterialRequisition) Hibernate
                                                                        .unproxy(
                                                                                        indentLine.indent.requisition);
                                                }
                                        }

                                        if (indentLine.material != null) {
                                                indentLine.material = (MatFlowMaterial) Hibernate.unproxy(
                                                                indentLine.material);
                                        }

                                        if (indentLine.requisitionLine != null &&
                                                        indentLine.requisitionLine.getId() != null) {
                                                MatFlowRequisitionLine requisitionLine = requisitionLineRepository
                                                                .findById(indentLine.requisitionLine.getId())
                                                                .map(value -> (MatFlowRequisitionLine) Hibernate
                                                                                .unproxy(value))
                                                                .orElse((MatFlowRequisitionLine) Hibernate.unproxy(
                                                                                indentLine.requisitionLine));

                                                if (requisitionLine.material != null) {
                                                        requisitionLine.material = (MatFlowMaterial) Hibernate.unproxy(
                                                                        requisitionLine.material);
                                                }

                                                if (requisitionLine.requisition != null) {
                                                        MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate
                                                                        .unproxy(
                                                                                        requisitionLine.requisition);

                                                        if (requisition.destinationLocation != null) {
                                                                requisition.destinationLocation = (MatFlowLocation) Hibernate
                                                                                .unproxy(
                                                                                                requisition.destinationLocation);
                                                        }

                                                        requisitionLine.requisition = requisition;
                                                }

                                                indentLine.requisitionLine = requisitionLine;
                                        }

                                        poLine.indentLine = indentLine;
                                }

                                line.purchaseOrderLine = poLine;
                        }

                        return line;
                }

                private MatFlowGoodsReceiptLine requireGoodsReceiptLineForQc(
                                MatFlowQcInspection inspection) {
                        if (inspection == null ||
                                        inspection.sourceLineId == null) {
                                throw conflict(
                                                "Goods Receipt QC inspection has no source GRN line");
                        }

                        MatFlowGoodsReceiptLine receiptLine = receiptLineRepository
                                        .findById(inspection.sourceLineId)
                                        .map(this::hydrateGoodsReceiptLine)
                                        .orElseThrow(() -> notFound(
                                                        "GRN line not found"));

                        if (receiptLine.goodsReceipt == null ||
                                        receiptLine.goodsReceipt.getId() == null) {
                                throw conflict(
                                                "GRN line is not linked to a valid Goods Receipt");
                        }

                        if (inspection.sourceId != null &&
                                        !inspection.sourceId.equals(
                                                        receiptLine.goodsReceipt.getId())) {
                                throw conflict(
                                                "QC inspection source does not match its Goods Receipt");
                        }

                        if (receiptLine.purchaseOrderLine == null ||
                                        receiptLine.purchaseOrderLine.getId() == null) {
                                throw conflict(
                                                "GRN line is not linked to a valid Purchase Order line");
                        }

                        MatFlowIndentLine indentLine = receiptLine.purchaseOrderLine.indentLine;

                        if (indentLine == null ||
                                        indentLine.getId() == null) {
                                throw conflict(
                                                "GRN Purchase Order line is not linked to a shortage Indent line");
                        }

                        if (indentLine.requisitionLine == null ||
                                        indentLine.requisitionLine.getId() == null) {
                                throw conflict(
                                                "GRN shortage Indent line is not linked to a Requisition line");
                        }

                        MatFlowRequisitionLine requisitionLine = indentLine.requisitionLine;

                        if (requisitionLine.requisition == null ||
                                        requisitionLine.requisition.getId() == null) {
                                throw conflict(
                                                "GRN shortage Requisition line is not linked to its Requisition");
                        }

                        if (inspection.material == null ||
                                        receiptLine.material == null ||
                                        !inspection.material.getId().equals(
                                                        receiptLine.material.getId())) {
                                throw conflict(
                                                "QC inspection material does not match the Goods Receipt line material");
                        }

                        if (receiptLine.goodsReceipt.receiptLocation != null &&
                                        inspection.location != null &&
                                        !receiptLine.goodsReceipt.receiptLocation.getId().equals(
                                                        inspection.location.getId())) {
                                throw conflict(
                                                "QC inspection location does not match the Goods Receipt location");
                        }

                        return receiptLine;
                }

                private MatFlowQcInspection requireInspection(
                                UUID id) {
                        MatFlowQcInspection inspection = qcRepository
                                        .findById(id)
                                        .map(this::hydrateInspection)
                                        .orElseThrow(() -> notFound(
                                                        "QC inspection not found"));

                        if (inspection.location == null) {
                                throw conflict(
                                                "QC check has no internal plant/custody context");
                        }

                        accessService.requirePlantAccess(
                                        inspection.location.getPlantCode());

                        return inspection;
                }

                private QcInspectionResponse toResponse(
                                MatFlowQcInspection inspection) {
                        inspection = hydrateInspection(inspection);
                        QcBusinessContext context = resolveBusinessContext(inspection);
                        MatFlowMaterialRequisition requisition = context.requisition();
                        MatFlowProjectDrawing product = requisition == null || requisition.projectDrawing == null
                                        ? null
                                        : (MatFlowProjectDrawing) Hibernate.unproxy(requisition.projectDrawing);

                        return new QcInspectionResponse(
                                        inspection.getId(),
                                        requisition == null ? null : requisition.getId(),
                                        context.requisitionNumber(),
                                        product == null ? null : product.getProjectCode(),
                                        product == null ? null : product.getDrawingNo(),
                                        product == null ? null : product.getProductName(),
                                        context.indentNumbers(),
                                        context.purchaseOrderNumbers(),
                                        context.grnNumbers(),
                                        inspection.sourceType,
                                        inspection.sourceId,
                                        inspection.sourceLineId,
                                        inspection.material == null ? null : inspection.material.getId(),
                                        inspection.material == null ? null : inspection.material.getMaterialCode(),
                                        inspection.material == null ? null : inspection.material.getMaterialName(),
                                        scale(inspection.inspectionQty),
                                        inspection.status,
                                        inspection.inspectedBy,
                                        inspection.inspectedAt,
                                        inspection.remarks,
                                        evidenceService.exists(inspection.getId()),
                                        inspection.getRowVersion());
                }

                private VendorReturnResponse toVendorReturnResponse(
                                MatFlowVendorReturn vendorReturn) {
                        return new VendorReturnResponse(
                                        vendorReturn.getId(),
                                        vendorReturn.returnNumber,
                                        vendorReturn.qcInspection
                                                        .getId(),
                                        vendorReturn.vendor
                                                        .getId(),
                                        vendorReturn.vendor.vendorName,
                                        vendorReturn.material
                                                        .getId(),
                                        vendorReturn.material
                                                        .getMaterialCode(),
                                        vendorReturn.fromLocation == null
                                                        ? null
                                                        : vendorReturn.fromLocation.getPlantCode(),
                                        vendorReturn.returnQty,
                                        vendorReturn.status,
                                        vendorReturn.dispatchedBy,
                                        vendorReturn.dispatchedAt,
                                        vendorReturn.remarks,
                                        vendorReturn.getRowVersion());
                }

                private void saveLedger(
                                MatFlowStockBalance balance,
                                MovementType type,
                                BigDecimal quantityChange,
                                BigDecimal reservedChange,
                                BigDecimal blockedChange,
                                BigDecimal transitChange,
                                MatFlowQcInspection inspection,
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

                        QcBusinessContext businessContext = resolveBusinessContext(inspection);
                        ledger.referenceType = "MATFLOW_QC";
                        ledger.referenceId = inspection.getId();
                        ledger.referenceNumber = businessContext.primaryReferenceNumber();
                        ledger.remarks = remarks;
                        ledger.actor = actor;

                        ledgerRepository.save(ledger);
                }

                private BigDecimal nonNegative(
                                BigDecimal value,
                                String field) {
                        BigDecimal result = scale(value);

                        if (result.compareTo(
                                        BigDecimal.ZERO) < 0) {
                                throw badRequest(
                                                field +
                                                                " cannot be negative");
                        }

                        return result;
                }

                private BigDecimal positive(
                                BigDecimal value,
                                String field) {
                        BigDecimal result = scale(value);

                        if (result.compareTo(
                                        BigDecimal.ZERO) <= 0) {
                                throw badRequest(
                                                field +
                                                                " must be greater than zero");
                        }

                        return result;
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
                                Long current) {
                        if (requested == null) {
                                throw badRequest(
                                                "QC rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                "QC inspection was modified by another user");
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

        private static final class DispositionModule {

                private final MatFlowQcDispositionRepository dispositionRepository;
                private final MatFlowQcInspectionRepository inspectionRepository;
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowTransferLineRepository transferLineRepository;
                private final MatFlowReservationRepository reservationRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowIndentRepository indentRepository;
                private final MatFlowIndentLineRepository indentLineRepository;
                private final MatFlowLocationRepository locationRepository;
                private final MatFlowStockBalanceRepository stockRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;

                DispositionModule(
                                MatFlowQcDispositionRepository dispositionRepository,
                                MatFlowQcInspectionRepository inspectionRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowTransferLineRepository transferLineRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowIndentRepository indentRepository,
                                MatFlowIndentLineRepository indentLineRepository,
                                MatFlowLocationRepository locationRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService) {
                        this.dispositionRepository = dispositionRepository;

                        this.inspectionRepository = inspectionRepository;

                        this.transferRepository = transferRepository;

                        this.transferLineRepository = transferLineRepository;

                        this.reservationRepository = reservationRepository;

                        this.requisitionLineRepository = requisitionLineRepository;

                        this.indentRepository = indentRepository;

                        this.indentLineRepository = indentLineRepository;

                        this.locationRepository = locationRepository;

                        this.stockRepository = stockRepository;

                        this.ledgerRepository = ledgerRepository;

                        this.accessService = accessService;

                        this.auditService = auditService;
                }

                @Transactional(readOnly = true)
                public List<QcDispositionResponse> list() {
                        accessService.requireRead();

                        return dispositionRepository
                                        .findAllByOrderByCreatedAtDesc()
                                        .stream()
                                        .filter(disposition -> accessService.canAccessPlant(
                                                        disposition.qcInspection.location.getPlantCode()))
                                        .map(this::toResponse)
                                        .toList();
                }

                @Transactional
                public QcDispositionResponse decide(
                                UUID inspectionId,
                                QcDispositionRequest request) {
                        accessService.requireQcDisposition();

                        if (request == null ||
                                        request.dispositionType() == null) {
                                throw badRequest(
                                                "QC disposition request and type are required");
                        }

                        MatFlowQcInspection inspection = inspectionRepository
                                        .findById(inspectionId)
                                        .orElseThrow(() -> notFound(
                                                        "QC inspection not found"));

                        accessService.requirePlantAccess(
                                        inspection.location.getPlantCode());

                        if (inspection.sourceType != QcSourceType.TRANSFER_RECEIPT) {
                                throw conflict(
                                                "This disposition workflow is only for internally transferred material");
                        }

                        if (inspection.status != QcInspectionStatus.COMPLETED) {
                                throw conflict(
                                                "QC inspection must be completed first");
                        }

                        assertVersion(
                                        request.rowVersion(),
                                        inspection.getRowVersion());

                        BigDecimal alreadyDisposed = dispositionRepository
                                        .findByQcInspection_IdOrderByCreatedAtAsc(
                                                        inspection.getId())
                                        .stream()
                                        .filter(disposition -> disposition.status != QcDispositionStatus.CANCELLED)
                                        .map(disposition -> disposition.dispositionQty)
                                        .reduce(
                                                        BigDecimal.ZERO,
                                                        BigDecimal::add);

                        BigDecimal outstandingRejected = inspection.rejectedQty
                                        .subtract(
                                                        alreadyDisposed);

                        BigDecimal quantity = positive(
                                        request.quantity(),
                                        "Disposition quantity");

                        if (quantity.compareTo(
                                        outstandingRejected) > 0) {
                                throw conflict(
                                                "Disposition quantity exceeds outstanding rejected quantity");
                        }

                        MatFlowTransferLine sourceTransferLine = transferLineRepository
                                        .findById(
                                                        inspection.sourceLineId)
                                        .orElseThrow(() -> notFound(
                                                        "Source transfer line not found"));

                        MatFlowTransferOrder sourceTransfer = sourceTransferLine.transferOrder;

                        MatFlowStockBalance qcBalance = stockRepository
                                        .lockBalance(
                                                        inspection.material
                                                                        .getId(),
                                                        inspection.location
                                                                        .getId())
                                        .orElseThrow(() -> conflict(
                                                        "Rejected QC stock balance not found"));

                        if (qcBalance.blockedQty
                                        .compareTo(quantity) < 0) {
                                throw conflict(
                                                "Rejected blocked quantity is no longer available");
                        }

                        String actor = accessService.actor();

                        MatFlowQcDisposition disposition = new MatFlowQcDisposition();

                        disposition.dispositionNumber = generateNumber("MFD");

                        disposition.qcInspection = inspection;

                        disposition.dispositionType = request.dispositionType();

                        disposition.dispositionQty = quantity;

                        disposition.decidedBy = actor;

                        disposition.decidedAt = LocalDateTime.now();

                        disposition.remarks = clean(request.remarks());

                        disposition.setCreatedBy(actor);
                        disposition.setUpdatedBy(actor);

                        if (request.dispositionType() == QcDispositionType.HOLD) {
                                disposition.status = QcDispositionStatus.OPEN;

                                disposition = dispositionRepository.save(
                                                disposition);

                                auditDisposition(
                                                disposition,
                                                sourceTransfer);

                                return toResponse(disposition);
                        }

                        if (request.dispositionType() == QcDispositionType.SCRAP) {
                                if (qcBalance.onHandQty
                                                .compareTo(quantity) < 0) {
                                        throw conflict(
                                                        "Rejected physical stock is insufficient");
                                }

                                qcBalance.onHandQty = scale(
                                                qcBalance.onHandQty
                                                                .subtract(quantity));

                                qcBalance.blockedQty = scale(
                                                qcBalance.blockedQty
                                                                .subtract(quantity));

                                qcBalance.setUpdatedBy(actor);

                                qcBalance = stockRepository.save(
                                                qcBalance);

                                disposition.status = QcDispositionStatus.COMPLETED;

                                disposition = dispositionRepository.save(
                                                disposition);

                                saveLedger(
                                                qcBalance,
                                                MovementType.SCRAP,

                                                quantity.negate(),
                                                BigDecimal.ZERO,
                                                quantity.negate(),

                                                disposition,
                                                actor);

                                /*
                                 * Only irrecoverable rejected stock becomes a Purchase
                                 * replacement requirement. HOLD/REWORK/RETURN_TO_SOURCE
                                 * must not create a market indent because the material may
                                 * still be recovered internally.
                                 */
                                ensureReplacementIndentForScrap(
                                                sourceTransfer.reservation.requisitionLine,
                                                quantity,
                                                inspection.location,
                                                actor);

                                auditDisposition(
                                                disposition,
                                                sourceTransfer);

                                return toResponse(disposition);
                        }

                        MatFlowLocation targetLocation = resolveTargetLocation(
                                        request,
                                        sourceTransfer);

                        qcBalance.blockedQty = scale(
                                        qcBalance.blockedQty
                                                        .subtract(quantity));

                        qcBalance.reservedQty = scale(
                                        qcBalance.reservedQty
                                                        .add(quantity));

                        qcBalance.setUpdatedBy(actor);

                        qcBalance = stockRepository.save(qcBalance);

                        MatFlowRequisitionLine requisitionLine = sourceTransfer.reservation.requisitionLine;

                        MatFlowReservation reservation = new MatFlowReservation();

                        reservation.requisitionLine = requisitionLine;

                        reservation.material = inspection.material;

                        reservation.sourceLocation = inspection.location;

                        reservation.firstDestinationLocation = targetLocation;

                        reservation.demandPlantCode = requisitionLine.requisition.destinationLocation.getPlantCode();

                        reservation.reservedQty = quantity;

                        reservation.status = ReservationStatus.ACTIVE;

                        reservation.routeSnapshotJson = "[]";

                        reservation.setCreatedBy(actor);
                        reservation.setUpdatedBy(actor);

                        reservation = reservationRepository.save(
                                        reservation);

                        requisitionLine.reservedQty = scale(
                                        requisitionLine.reservedQty
                                                        .add(quantity));

                        requisitionLine.shortageQty = scale(
                                        requisitionLine.shortageQty
                                                        .subtract(quantity)
                                                        .max(BigDecimal.ZERO));

                        requisitionLine.setUpdatedBy(actor);

                        requisitionLineRepository.save(
                                        requisitionLine);

                        MatFlowTransferOrder transfer = new MatFlowTransferOrder();

                        transfer.transferNumber = generateNumber("MFT");

                        transfer.requisition = requisitionLine.requisition;

                        transfer.reservation = reservation;

                        transfer.fromLocation = inspection.location;

                        transfer.toLocation = targetLocation;

                        transfer.routeSequenceNo = 9000;

                        transfer.predecessorTransferId = null;

                        transfer.purpose = request.dispositionType() == QcDispositionType.REWORK
                                        ? TransferPurpose.QC_TO_REWORK
                                        : TransferPurpose.RETURN_TO_SOURCE;

                        transfer.status = TransferStatus.READY;

                        transfer.remarks = "Generated from QC rejected-material disposition";

                        transfer.setCreatedBy(actor);
                        transfer.setUpdatedBy(actor);

                        transfer = transferRepository.save(transfer);

                        MatFlowTransferLine transferLine = new MatFlowTransferLine();

                        transferLine.transferOrder = transfer;

                        transferLine.material = inspection.material;

                        transferLine.plannedQty = quantity;

                        transferLine.dispatchedQty = BigDecimal.ZERO;

                        transferLine.receivedQty = BigDecimal.ZERO;

                        transferLine.uom = inspection.material.getUom();

                        transferLine.setCreatedBy(actor);
                        transferLine.setUpdatedBy(actor);

                        transferLineRepository.save(
                                        transferLine);

                        disposition.targetLocation = targetLocation;

                        disposition.generatedReservation = reservation;

                        disposition.generatedTransfer = transfer;

                        disposition.status = QcDispositionStatus.TRANSFER_CREATED;

                        disposition = dispositionRepository.save(
                                        disposition);

                        saveLedger(
                                        qcBalance,
                                        MovementType.QC_REWORK_RELEASE,

                                        BigDecimal.ZERO,
                                        quantity,
                                        quantity.negate(),

                                        disposition,
                                        actor);

                        auditDisposition(
                                        disposition,
                                        sourceTransfer);

                        return toResponse(disposition);
                }

                private void ensureReplacementIndentForScrap(
                                MatFlowRequisitionLine requisitionLine,
                                BigDecimal shortageQty,
                                MatFlowLocation qcLocation,
                                String actor) {
                        if (requisitionLine == null ||
                                        requisitionLine.requisition == null ||
                                        requisitionLine.material == null ||
                                        qcLocation == null ||
                                        shortageQty == null ||
                                        shortageQty.compareTo(BigDecimal.ZERO) <= 0) {
                                return;
                        }

                        MatFlowMaterialRequisition requisition = requisitionLine.requisition;

                        MatFlowIndent indent = indentRepository
                                        .findByRequisition_Id(requisition.getId())
                                        .stream()
                                        .filter(existing -> existing.status == IndentStatus.AUTO_CREATED ||
                                                        existing.status == IndentStatus.DRAFT ||
                                                        existing.status == IndentStatus.RETURNED)
                                        .filter(existing -> existing.deliverToLocation != null &&
                                                        existing.deliverToLocation.getId().equals(qcLocation.getId()))
                                        .findFirst()
                                        .orElse(null);

                        if (indent == null) {
                                indent = new MatFlowIndent();
                                indent.indentNumber = generateNumber("MFI");
                                indent.requisition = requisition;
                                indent.projectDrawing = requisition.projectDrawing;
                                indent.bom = requisition.bom;
                                indent.deliverToLocation = qcLocation;
                                indent.status = IndentStatus.AUTO_CREATED;
                                indent.autoGenerated = true;
                                indent.remarks = "Replacement shortage created after QC scrap";
                                indent.setCreatedBy(actor);
                                indent.setUpdatedBy(actor);
                                indent = indentRepository.save(indent);
                        }

                        MatFlowIndentLine indentLine = indentLineRepository
                                        .findByIndent_IdOrderByCreatedAtAsc(indent.getId())
                                        .stream()
                                        .filter(existing -> existing.requisitionLine != null &&
                                                        existing.requisitionLine.getId()
                                                                        .equals(requisitionLine.getId()))
                                        .findFirst()
                                        .orElse(null);

                        if (indentLine == null) {
                                indentLine = new MatFlowIndentLine();
                                indentLine.indent = indent;
                                indentLine.requisitionLine = requisitionLine;
                                indentLine.material = requisitionLine.material;
                                indentLine.requiredQty = scale(shortageQty);
                                indentLine.orderedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                                indentLine.receivedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                                indentLine.uom = requisitionLine.material.getUom();
                                indentLine.remarks = "Replacement required for QC-scrapped material";
                                indentLine.setCreatedBy(actor);
                        } else {
                                indentLine.requiredQty = scale(indentLine.requiredQty)
                                                .add(shortageQty)
                                                .setScale(3, RoundingMode.HALF_UP);
                        }

                        indentLine.setUpdatedBy(actor);
                        indentLineRepository.save(indentLine);
                }

                private void auditDisposition(
                                MatFlowQcDisposition disposition,
                                MatFlowTransferOrder sourceTransfer) {
                        String projectCode = null;
                        String drawingNo = null;

                        if (sourceTransfer != null &&
                                        sourceTransfer.requisition != null &&
                                        sourceTransfer.requisition.projectDrawing != null) {
                                projectCode = sourceTransfer.requisition.projectDrawing
                                                .getProjectCode();
                                drawingNo = sourceTransfer.requisition.projectDrawing
                                                .getDrawingNo();
                        }

                        auditService.record(
                                        "QC_DISPOSITION",
                                        disposition.getId(),
                                        "QC_DISPOSITION_DECIDED",
                                        disposition.qcInspection.location.getPlantCode(),
                                        projectCode,
                                        drawingNo,
                                        auditService.details(
                                                        "dispositionNumber",
                                                        disposition.dispositionNumber,
                                                        "inspectionId",
                                                        disposition.qcInspection.getId(),
                                                        "materialCode",
                                                        disposition.qcInspection.material.getMaterialCode(),
                                                        "dispositionType",
                                                        disposition.dispositionType,
                                                        "dispositionQty",
                                                        disposition.dispositionQty,
                                                        "status",
                                                        disposition.status,
                                                        "targetCustody",
                                                        disposition.targetLocation == null
                                                                        ? null
                                                                        : disposition.targetLocation.getLocationCode(),
                                                        "targetPlantCode",
                                                        disposition.targetLocation == null
                                                                        ? null
                                                                        : disposition.targetLocation.getPlantCode()));
                }

                private MatFlowLocation resolveTargetLocation(
                                QcDispositionRequest request,
                                MatFlowTransferOrder sourceTransfer) {
                        if (request.dispositionType() == QcDispositionType.RETURN_TO_SOURCE) {
                                return sourceTransfer.fromLocation;
                        }

                        String targetCustody = clean(request.targetCustody());
                        if (targetCustody == null) {
                                throw badRequest("Target Processing Unit is required for rework");
                        }

                        MatFlowLocation target = locationRepository.findAll().stream()
                                        .filter(value -> value != null && value.isActive())
                                        .filter(value -> value.getLocationCode() != null
                                                        && value.getLocationCode().equalsIgnoreCase(targetCustody))
                                        .filter(value -> value.getLocationType() == MatFlowPlanningTypes.LocationType.PROCESSING
                                                        || value.getLocationType() == MatFlowPlanningTypes.LocationType.EXTERNAL_PROCESSOR)
                                        .findFirst()
                                        .orElseThrow(() -> notFound("Processing Unit not found: " + targetCustody));

                        accessService.requirePlantAccess(target.getPlantCode());
                        return target;
                }

                private QcDispositionResponse toResponse(
                                MatFlowQcDisposition disposition) {
                        return new QcDispositionResponse(
                                        disposition.getId(),
                                        disposition.dispositionNumber,
                                        disposition.qcInspection
                                                        .getId(),
                                        disposition.dispositionType,
                                        disposition.status,

                                        disposition.targetLocation == null
                                                        ? null
                                                        : disposition.targetLocation.getLocationCode(),

                                        disposition.targetLocation == null
                                                        ? null
                                                        : disposition.targetLocation.getPlantCode(),

                                        disposition.dispositionQty,

                                        disposition.generatedReservation == null
                                                        ? null
                                                        : disposition.generatedReservation
                                                                        .getId(),

                                        disposition.generatedTransfer == null
                                                        ? null
                                                        : disposition.generatedTransfer
                                                                        .getId(),

                                        disposition.decidedBy,
                                        disposition.decidedAt,
                                        disposition.remarks,
                                        disposition.getRowVersion());
                }

                private void saveLedger(
                                MatFlowStockBalance balance,
                                MovementType movementType,
                                BigDecimal quantityChange,
                                BigDecimal reservedChange,
                                BigDecimal blockedChange,
                                MatFlowQcDisposition disposition,
                                String actor) {
                        MatFlowStockLedger ledger = new MatFlowStockLedger();

                        ledger.material = balance.material;

                        ledger.location = balance.location;

                        ledger.movementType = movementType;

                        ledger.quantityChange = scale(quantityChange);

                        ledger.reservedChange = scale(reservedChange);

                        ledger.blockedChange = scale(blockedChange);

                        ledger.inTransitChange = BigDecimal.ZERO;

                        ledger.onHandAfter = balance.onHandQty;

                        ledger.reservedAfter = balance.reservedQty;

                        ledger.blockedAfter = balance.blockedQty;

                        ledger.inTransitAfter = balance.inTransitQty;

                        ledger.referenceType = "MATFLOW_QC_DISPOSITION";

                        ledger.referenceId = disposition.getId();

                        ledger.referenceNumber = disposition.dispositionNumber;

                        ledger.actor = actor;

                        ledgerRepository.save(ledger);
                }

                private BigDecimal positive(
                                BigDecimal value,
                                String field) {
                        BigDecimal result = scale(value);

                        if (result.compareTo(
                                        BigDecimal.ZERO) <= 0) {
                                throw badRequest(
                                                field +
                                                                " must be greater than zero");
                        }

                        return result;
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
                                Long current) {
                        if (requested == null) {
                                throw badRequest(
                                                "QC inspection rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                "QC inspection was modified by another user");
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
}
