package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcDecisionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcInspectionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnResponse;

import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.*;
import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Unified QC service for purchased and internally transferred material.
 * Accepted/rejected inspection decisions and rejected-material disposition
 * now share one service boundary.
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
                        MatFlowTransferOrderRepository transferRepository,
                        MatFlowTransferLineRepository transferLineRepository,
                        MatFlowVendorReturnRepository vendorReturnRepository,
                        MatFlowQcDispositionRepository dispositionRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowBomService bomService,
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService,
                        MatFlowRequisitionService requisitionService) {

                this.qc = new QcModule(
                                qcRepository,
                                receiptRepository,
                                receiptLineRepository,
                                stockRepository,
                                ledgerRepository,
                                reservationRepository,
                                requisitionLineRepository,
                                transferRepository,
                                transferLineRepository,
                                vendorReturnRepository,
                                bomService,
                                accessService,
                                auditService,
                                requisitionService);

                this.disposition = new DispositionModule(
                                dispositionRepository,
                                qcRepository,
                                transferRepository,
                                transferLineRepository,
                                reservationRepository,
                                requisitionLineRepository,
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
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowTransferLineRepository transferLineRepository;
                private final MatFlowVendorReturnRepository vendorReturnRepository;
                private final MatFlowBomService routingService;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;
                private final MatFlowRequisitionService requisitionService;

                QcModule(
                                MatFlowQcInspectionRepository qcRepository,
                                MatFlowGoodsReceiptRepository receiptRepository,
                                MatFlowGoodsReceiptLineRepository receiptLineRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowTransferLineRepository transferLineRepository,
                                MatFlowVendorReturnRepository vendorReturnRepository,
                                MatFlowBomService routingService,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService,
                                MatFlowRequisitionService requisitionService) {
                        this.qcRepository = qcRepository;

                        this.receiptRepository = receiptRepository;

                        this.receiptLineRepository = receiptLineRepository;

                        this.stockRepository = stockRepository;

                        this.ledgerRepository = ledgerRepository;

                        this.reservationRepository = reservationRepository;

                        this.requisitionLineRepository = requisitionLineRepository;

                        this.transferRepository = transferRepository;

                        this.transferLineRepository = transferLineRepository;

                        this.vendorReturnRepository = vendorReturnRepository;

                        this.routingService = routingService;

                        this.accessService = accessService;

                        this.auditService = auditService;
                        this.requisitionService = requisitionService;
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
                                        .filter(inspection -> accessService.canAccessPlant(
                                                        inspection.location.plantCode))
                                        .map(this::toResponse)
                                        .toList();
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

                        BigDecimal accepted = nonNegative(
                                        request.acceptedQty(),
                                        "Accepted quantity");

                        BigDecimal rejected = nonNegative(
                                        request.rejectedQty(),
                                        "Rejected quantity");

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

                        auditService.record(
                                        "QC_INSPECTION",
                                        inspection.getId(),
                                        "QC_COMPLETED",
                                        inspection.location.plantCode,
                                        null,
                                        null,
                                        auditService.details(
                                                        "inspectionNumber",
                                                        inspection.inspectionNumber,
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

                        MatFlowGoodsReceiptLine receiptLine = receiptLineRepository
                                        .findById(
                                                        inspection.sourceLineId)
                                        .orElseThrow(() -> notFound(
                                                        "GRN line not found"));

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
                        MatFlowGoodsReceiptLine receiptLine = receiptLineRepository
                                        .findById(
                                                        inspection.sourceLineId)
                                        .orElseThrow(() -> notFound(
                                                        "GRN line not found"));

                        receiptLine.acceptedQty = accepted;

                        receiptLine.rejectedQty = inspection.inspectionQty
                                        .subtract(accepted);

                        receiptLine.setUpdatedBy(actor);

                        receiptLineRepository.save(
                                        receiptLine);

                        refreshGoodsReceiptStatus(
                                        receiptLine.goodsReceipt,
                                        actor);

                        if (accepted.compareTo(
                                        BigDecimal.ZERO) <= 0) {
                                return BigDecimal.ZERO;
                        }

                        MatFlowRequisitionLine requisitionLine = receiptLine.purchaseOrderLine.indentLine.requisitionLine;

                        MatFlowMaterialRequisition requisition = requisitionLine.requisition;

                        MatFlowReservation reservation = new MatFlowReservation();

                        reservation.requisitionLine = requisitionLine;

                        reservation.material = inspection.material;

                        reservation.sourceLocation = inspection.location;

                        reservation.firstDestinationLocation = inspection.location;

                        reservation.demandPlantCode = requisition.destinationLocation.plantCode;

                        reservation.reservedQty = accepted;

                        reservation.status = ReservationStatus.ACTIVE;

                        reservation.routeSnapshotJson = "[]";

                        reservation.setCreatedBy(actor);
                        reservation.setUpdatedBy(actor);

                        reservation = reservationRepository.save(
                                        reservation);

                        requisitionLine.reservedQty = scale(
                                        requisitionLine.reservedQty
                                                        .add(accepted));

                        requisitionLine.shortageQty = scale(
                                        requisitionLine.shortageQty
                                                        .subtract(accepted)
                                                        .max(BigDecimal.ZERO));

                        requisitionLine.setUpdatedBy(actor);

                        requisitionLineRepository.save(
                                        requisitionLine);

                        createRemainingTransferChain(
                                        reservation,
                                        requisition,
                                        requisitionLine,
                                        inspection.location,
                                        accepted,
                                        actor);

                        requisitionService.refreshState(
                                        requisition.getId(),
                                        actor);

                        return accepted;
                }

                private BigDecimal completeTransferQc(
                                MatFlowQcInspection inspection,
                                BigDecimal accepted,
                                BigDecimal rejected,
                                String actor) {
                        MatFlowTransferLine sourceLine = transferLineRepository
                                        .findById(
                                                        inspection.sourceLineId)
                                        .orElseThrow(() -> notFound(
                                                        "Transfer line not found"));

                        MatFlowTransferOrder sourceTransfer = sourceLine.transferOrder;

                        if (sourceTransfer.status != TransferStatus.RECEIVED) {
                                throw conflict(
                                                "Transfer must be completely received before QC decision");
                        }

                        MatFlowReservation reservation = sourceTransfer.reservation;

                        MatFlowRequisitionLine requisitionLine = reservation.requisitionLine;

                        reservation.reservedQty = accepted;

                        reservation.status = accepted.compareTo(
                                        BigDecimal.ZERO) > 0
                                                        ? ReservationStatus.ACTIVE
                                                        : ReservationStatus.CANCELLED;

                        reservation.setUpdatedBy(actor);

                        reservationRepository.save(
                                        reservation);

                        if (rejected.compareTo(
                                        BigDecimal.ZERO) > 0) {
                                requisitionLine.reservedQty = scale(
                                                requisitionLine.reservedQty
                                                                .subtract(rejected)
                                                                .max(BigDecimal.ZERO));

                                requisitionLine.shortageQty = scale(
                                                requisitionLine.shortageQty
                                                                .add(rejected));

                        }

                        requisitionLine.setUpdatedBy(actor);

                        requisitionLineRepository.save(
                                        requisitionLine);

                        requisitionService.refreshState(
                                        requisitionLine.requisition.getId(),
                                        actor);

                        MatFlowTransferOrder successor = transferRepository
                                        .findByPredecessorTransferId(
                                                        sourceTransfer.getId())
                                        .orElse(null);

                        if (successor != null) {
                                MatFlowTransferLine successorLine = transferLineRepository
                                                .findFirstByTransferOrder_IdOrderByCreatedAtAsc(
                                                                successor.getId())
                                                .orElseThrow(() -> conflict(
                                                                "Successor transfer line not found"));

                                successorLine.plannedQty = accepted;

                                successorLine.setUpdatedBy(actor);

                                transferLineRepository.save(
                                                successorLine);

                                successor.status = accepted.compareTo(
                                                BigDecimal.ZERO) > 0
                                                                ? TransferStatus.READY
                                                                : TransferStatus.CANCELLED;

                                successor.setUpdatedBy(actor);

                                transferRepository.save(successor);
                        }

                        return accepted;
                }

                private void createRemainingTransferChain(
                                MatFlowReservation reservation,
                                MatFlowMaterialRequisition requisition,
                                MatFlowRequisitionLine requisitionLine,
                                MatFlowLocation currentLocation,
                                BigDecimal quantity,
                                String actor) {
                        List<MatFlowBomRouteStep> route = routingService.routeForLine(
                                        requisitionLine.bomLine
                                                        .getId());

                        List<MatFlowLocation> remaining = new ArrayList<>();

                        if (route.isEmpty()) {
                                if (!currentLocation.getId()
                                                .equals(
                                                                requisition.destinationLocation
                                                                                .getId())) {
                                        remaining.add(
                                                        requisition.destinationLocation);
                                }
                        } else {
                                int currentIndex = -1;

                                for (int index = 0; index < route.size(); index++) {
                                        if (route.get(index).location
                                                        .getId()
                                                        .equals(
                                                                        currentLocation
                                                                                        .getId())) {
                                                currentIndex = index;
                                                break;
                                        }
                                }

                                if (currentIndex < 0) {
                                        throw conflict(
                                                        "GRN/QC location is not part of the approved BOM route");
                                }

                                for (int index = currentIndex + 1; index < route.size(); index++) {
                                        remaining.add(
                                                        route.get(index).location);
                                }
                        }

                        MatFlowLocation from = currentLocation;

                        UUID predecessor = null;
                        int sequence = 10;

                        boolean processingCurrent = currentLocation.locationType == LocationType.PROCESSING ||
                                        currentLocation.locationType == LocationType.EXTERNAL_PROCESSOR;

                        for (MatFlowLocation destination : remaining) {
                                if (from.getId()
                                                .equals(
                                                                destination.getId())) {
                                        continue;
                                }

                                MatFlowTransferOrder transfer = new MatFlowTransferOrder();

                                transfer.transferNumber = generateNumber("MFT");

                                transfer.requisition = requisition;

                                transfer.reservation = reservation;

                                transfer.fromLocation = from;
                                transfer.toLocation = destination;

                                transfer.routeSequenceNo = sequence;

                                transfer.predecessorTransferId = predecessor;

                                transfer.purpose = determinePurpose(
                                                from,
                                                destination);

                                transfer.status = predecessor == null &&
                                                !processingCurrent
                                                                ? TransferStatus.READY
                                                                : TransferStatus.PLANNED;

                                transfer.remarks = "Created after incoming material QC acceptance";

                                transfer.setCreatedBy(actor);
                                transfer.setUpdatedBy(actor);

                                transfer = transferRepository.save(
                                                transfer);

                                MatFlowTransferLine transferLine = new MatFlowTransferLine();

                                transferLine.transferOrder = transfer;

                                transferLine.material = reservation.material;

                                transferLine.plannedQty = quantity;

                                transferLine.dispatchedQty = BigDecimal.ZERO;

                                transferLine.receivedQty = BigDecimal.ZERO;

                                transferLine.uom = reservation.material
                                                .getUom();

                                transferLine.setCreatedBy(actor);
                                transferLine.setUpdatedBy(actor);

                                transferLineRepository.save(
                                                transferLine);

                                predecessor = transfer.getId();

                                from = destination;
                                sequence += 10;
                        }
                }

                private TransferPurpose determinePurpose(
                                MatFlowLocation from,
                                MatFlowLocation to) {
                        if (!from.plantCode.equalsIgnoreCase(
                                        to.plantCode)) {
                                return TransferPurpose.INTER_PLANT;
                        }

                        if (to.locationType == LocationType.QC) {
                                return TransferPurpose.QC_TRANSFER;
                        }

                        boolean fromProcessing = from.locationType == LocationType.PROCESSING ||
                                        from.locationType == LocationType.EXTERNAL_PROCESSOR;

                        boolean toProcessing = to.locationType == LocationType.PROCESSING ||
                                        to.locationType == LocationType.EXTERNAL_PROCESSOR;

                        if (fromProcessing && toProcessing) {
                                return TransferPurpose.PROCESSING_TO_PROCESSING;
                        }

                        if (fromProcessing &&
                                        to.locationType == LocationType.PRODUCTION) {
                                return TransferPurpose.PROCESSING_TO_PRODUCTION;
                        }

                        if (toProcessing) {
                                return TransferPurpose.STORE_TO_PROCESSING;
                        }

                        return TransferPurpose.STORE_TO_PRODUCTION;
                }

                private void refreshGoodsReceiptStatus(
                                MatFlowGoodsReceipt receipt,
                                String actor) {
                        List<MatFlowGoodsReceiptLine> lines = receiptLineRepository
                                        .findByGoodsReceipt_IdOrderByCreatedAtAsc(
                                                        receipt.getId());

                        boolean allInspected = lines.stream()
                                        .allMatch(line -> line.acceptedQty
                                                        .add(
                                                                        line.rejectedQty)
                                                        .compareTo(
                                                                        line.receivedQty) >= 0);

                        if (!allInspected) {
                                receipt.status = GoodsReceiptStatus.QC_PENDING;
                        } else {
                                boolean allAccepted = lines.stream()
                                                .allMatch(line -> line.acceptedQty
                                                                .compareTo(
                                                                                line.receivedQty) >= 0);

                                boolean allRejected = lines.stream()
                                                .allMatch(line -> line.rejectedQty
                                                                .compareTo(
                                                                                line.receivedQty) >= 0);

                                boolean allRejectedReturned = lines.stream()
                                                .allMatch(line -> line.returnedQty
                                                                .compareTo(
                                                                                line.rejectedQty) >= 0);

                                if (allRejectedReturned &&
                                                lines.stream()
                                                                .anyMatch(line -> line.rejectedQty
                                                                                .compareTo(
                                                                                                BigDecimal.ZERO) > 0)) {
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

                private MatFlowQcInspection requireInspection(
                                UUID id) {
                        MatFlowQcInspection inspection = qcRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "QC inspection not found"));

                        accessService.requirePlantAccess(
                                        inspection.location.plantCode);

                        return inspection;
                }

                private QcInspectionResponse toResponse(
                                MatFlowQcInspection inspection) {
                        return new QcInspectionResponse(
                                        inspection.getId(),
                                        inspection.inspectionNumber,
                                        inspection.sourceType,
                                        inspection.sourceId,
                                        inspection.sourceLineId,
                                        inspection.material.getId(),
                                        inspection.material
                                                        .getMaterialCode(),
                                        inspection.material
                                                        .getMaterialName(),
                                        inspection.location.getId(),
                                        inspection.location.locationCode,
                                        inspection.location.plantCode,
                                        inspection.inspectionQty,
                                        inspection.acceptedQty,
                                        inspection.rejectedQty,
                                        inspection.status,
                                        inspection.inspectedBy,
                                        inspection.inspectedAt,
                                        inspection.remarks,
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
                                        vendorReturn.fromLocation
                                                        .getId(),
                                        vendorReturn.fromLocation.locationCode,
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

                        ledger.referenceType = "MATFLOW_QC";
                        ledger.referenceId = inspection.getId();
                        ledger.referenceNumber = inspection.inspectionNumber;
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
                                                        disposition.qcInspection.location.plantCode))
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
                                        inspection.location.plantCode);

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

                        reservation.demandPlantCode = requisitionLine.requisition.destinationLocation.plantCode;

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
                                        disposition.qcInspection.location.plantCode,
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
                                                        "targetLocationId",
                                                        disposition.targetLocation == null
                                                                        ? null
                                                                        : disposition.targetLocation.getId()));
                }

                private MatFlowLocation resolveTargetLocation(
                                QcDispositionRequest request,
                                MatFlowTransferOrder sourceTransfer) {
                        if (request.dispositionType() == QcDispositionType.RETURN_TO_SOURCE) {
                                return sourceTransfer.fromLocation;
                        }

                        if (request.targetLocationId() == null) {
                                throw badRequest(
                                                "Target processing location is required for rework");
                        }

                        MatFlowLocation target = locationRepository
                                        .findById(
                                                        request.targetLocationId())
                                        .orElseThrow(() -> notFound(
                                                        "Target location not found"));

                        accessService.requirePlantAccess(
                                        target.plantCode);

                        boolean processingLocation = target.locationType == MatFlowPlanningTypes.LocationType.PROCESSING
                                        ||
                                        target.locationType == MatFlowPlanningTypes.LocationType.EXTERNAL_PROCESSOR;

                        if (!processingLocation) {
                                throw badRequest(
                                                "Rework target must be a processing location");
                        }

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
                                                        : disposition.targetLocation
                                                                        .getId(),

                                        disposition.targetLocation == null
                                                        ? null
                                                        : disposition.targetLocation.locationCode,

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
