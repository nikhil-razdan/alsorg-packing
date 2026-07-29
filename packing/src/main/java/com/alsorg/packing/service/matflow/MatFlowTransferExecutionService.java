package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowQcInspection;
import com.alsorg.packing.repository.matflow.MatFlowQcInspectionRepository;

import java.time.LocalDate;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowTransferLine;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowTransferExecutionService {

    private final MatFlowTransferOrderRepository transferRepository;
    private final MatFlowTransferLineRepository transferLineRepository;
    private final MatFlowStockBalanceRepository stockRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowReservationRepository reservationRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowQcInspectionRepository qcRepository;
    private final MatFlowAuditService auditService;

    public MatFlowTransferExecutionService(
            MatFlowTransferOrderRepository transferRepository,
            MatFlowTransferLineRepository transferLineRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowReservationRepository reservationRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowAccessService accessService,
            MatFlowQcInspectionRepository qcRepository,
            MatFlowAuditService auditService) {
        this.transferRepository = transferRepository;

        this.transferLineRepository = transferLineRepository;

        this.stockRepository = stockRepository;

        this.ledgerRepository = ledgerRepository;

        this.reservationRepository = reservationRepository;

        this.requisitionLineRepository = requisitionLineRepository;

        this.requisitionRepository = requisitionRepository;

        this.accessService = accessService;

        this.qcRepository = qcRepository;

        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TransferResponse> list(
            TransferStatus status,
            String plantCode) {
        accessService.requireRead();

        String cleanPlant = cleanUpper(plantCode);

        if (cleanPlant != null) {
            accessService.requirePlantAccess(
                    cleanPlant);
        }

        return transferRepository
                .findAllByOrderByUpdatedAtDesc()
                .stream()
                .filter(transfer -> accessService.canAccessPlant(
                        transfer.fromLocation.plantCode) ||
                        accessService.canAccessPlant(
                                transfer.toLocation.plantCode))
                .filter(transfer -> status == null ||
                        transfer.status == status)
                .filter(transfer -> cleanPlant == null ||
                        transfer.fromLocation.plantCode
                                .equalsIgnoreCase(cleanPlant)
                        ||
                        transfer.toLocation.plantCode
                                .equalsIgnoreCase(cleanPlant))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TransferResponse get(
            UUID id) {
        accessService.requireRead();

        MatFlowTransferOrder transfer = requireVisibleTransfer(id);

        return toResponse(transfer);
    }

    @Transactional
    public TransferResponse dispatch(
            UUID id,
            TransferActionRequest request) {
        MatFlowTransferOrder transfer = requireTransfer(id);

        accessService.requireTransferDispatch(
                transfer.fromLocation);

        if (transfer.status != TransferStatus.READY &&
                transfer.status != TransferStatus.PARTIALLY_DISPATCHED) {
            throw conflict(
                    "Only a Ready or Partially Dispatched transfer can be dispatched");
        }

        assertVersion(
                request == null
                        ? null
                        : request.rowVersion(),
                transfer.getRowVersion(),
                "Transfer");

        validatePredecessor(transfer);

        MatFlowTransferLine transferLine = requireTransferLine(
                transfer.getId());

        BigDecimal remainingToDispatch = transferLine.plannedQty
                .subtract(
                        transferLine.dispatchedQty);

        BigDecimal quantity = positiveQuantity(
                request == null
                        ? null
                        : request.quantity(),
                remainingToDispatch,
                "Dispatch quantity");

        MatFlowStockBalance sourceBalance = stockRepository
                .lockBalance(
                        transferLine.material.getId(),
                        transfer.fromLocation.getId())
                .orElseThrow(() -> conflict(
                        "No stock balance exists at the transfer source"));

        /*
         * Transfer stock is reserved at every active source:
         *
         * 1. Initial source is reserved during planning.
         * 2. Intermediate destination is reserved when the
         * preceding transfer is received.
         */
        if (sourceBalance.reservedQty
                .compareTo(quantity) < 0) {
            throw conflict(
                    "Insufficient reserved stock at source location");
        }

        BigDecimal usablePhysicalQty = sourceBalance.onHandQty
                .subtract(
                        sourceBalance.blockedQty);

        if (usablePhysicalQty
                .compareTo(quantity) < 0) {
            throw conflict(
                    "Insufficient usable physical stock at source location");
        }

        String actor = accessService.actor();

        sourceBalance.onHandQty = scale(
                sourceBalance.onHandQty
                        .subtract(quantity));

        sourceBalance.reservedQty = scale(
                sourceBalance.reservedQty
                        .subtract(quantity));

        sourceBalance.inTransitQty = scale(
                sourceBalance.inTransitQty
                        .add(quantity));

        sourceBalance.setUpdatedBy(actor);

        sourceBalance = stockRepository.save(
                sourceBalance);

        transferLine.dispatchedQty = scale(
                transferLine.dispatchedQty
                        .add(quantity));

        transferLine.setUpdatedBy(actor);

        transferLineRepository.save(
                transferLine);

        if (transferLine.dispatchedQty
                .compareTo(
                        transferLine.plannedQty) < 0) {
            transfer.status = TransferStatus.PARTIALLY_DISPATCHED;
        } else {
            transfer.status = TransferStatus.IN_TRANSIT;
        }

        transfer.setUpdatedBy(actor);

        transfer = transferRepository.save(
                transfer);

        if (transfer.predecessorTransferId == null &&
                transferLine.dispatchedQty
                        .compareTo(
                                transferLine.plannedQty) >= 0) {
            MatFlowReservation reservation = transfer.reservation;

            reservation.status = ReservationStatus.RELEASED;

            reservation.setUpdatedBy(actor);

            reservationRepository.save(
                    reservation);
        }

        auditService.record(
                "TRANSFER",
                transfer.getId(),
                "DISPATCHED",
                transfer.fromLocation.plantCode,
                transfer.requisition.projectDrawing
                        .getProjectCode(),
                transfer.requisition.projectDrawing
                        .getDrawingNo(),
                auditService.details(
                        "transferNumber",
                        transfer.transferNumber,
                        "fromLocation",
                        transfer.fromLocation.locationCode,
                        "toLocation",
                        transfer.toLocation.locationCode,
                        "quantity",
                        quantity,
                        "status",
                        transfer.status));

        saveLedger(
                sourceBalance,
                MovementType.TRANSFER_OUT,

                quantity.negate(),
                quantity.negate(),
                BigDecimal.ZERO,
                quantity,

                transfer,
                request == null
                        ? null
                        : request.batchNo(),
                request == null
                        ? null
                        : request.remarks(),
                actor);

        return toResponse(transfer);
    }

    @Transactional
    public TransferResponse receive(
            UUID id,
            TransferActionRequest request) {
        MatFlowTransferOrder transfer = requireTransfer(id);

        accessService.requireTransferReceive(
                transfer.toLocation);

        if (transfer.status != TransferStatus.IN_TRANSIT &&
                transfer.status != TransferStatus.PARTIALLY_DISPATCHED &&
                transfer.status != TransferStatus.PARTIALLY_RECEIVED) {
            throw conflict(
                    "Transfer is not available for receipt");
        }

        assertVersion(
                request == null
                        ? null
                        : request.rowVersion(),
                transfer.getRowVersion(),
                "Transfer");

        MatFlowTransferLine transferLine = requireTransferLine(
                transfer.getId());

        BigDecimal outstandingReceipt = transferLine.dispatchedQty
                .subtract(
                        transferLine.receivedQty);

        BigDecimal quantity = positiveQuantity(
                request == null
                        ? null
                        : request.quantity(),
                outstandingReceipt,
                "Received quantity");

        String actor = accessService.actor();

        MatFlowStockBalance sourceBalance = stockRepository
                .lockBalance(
                        transferLine.material.getId(),
                        transfer.fromLocation.getId())
                .orElseThrow(() -> conflict(
                        "Source stock balance not found"));

        if (sourceBalance.inTransitQty
                .compareTo(quantity) < 0) {
            throw conflict(
                    "Received quantity exceeds source in-transit quantity");
        }

        sourceBalance.inTransitQty = scale(
                sourceBalance.inTransitQty
                        .subtract(quantity));

        sourceBalance.setUpdatedBy(actor);

        sourceBalance = stockRepository.save(
                sourceBalance);

        MatFlowStockBalance destinationBalance = lockOrCreateDestinationBalance(
                transferLine.material,
                transfer.toLocation,
                actor);

        destinationBalance.onHandQty = scale(
                destinationBalance.onHandQty
                        .add(quantity));

        boolean qcDestination = transfer.toLocation.locationType == LocationType.QC;

        boolean hasSuccessor = transferRepository
                .existsByPredecessorTransferId(
                        transfer.getId());

        boolean dispositionTransfer = transfer.purpose == TransferPurpose.QC_TO_REWORK ||
                transfer.purpose == TransferPurpose.RETURN_TO_SOURCE;

        BigDecimal blockedAdded = BigDecimal.ZERO;

        BigDecimal reservedAdded = BigDecimal.ZERO;

        if (qcDestination) {
            /*
             * QC stock is physically received but unavailable
             * until an inspection releases it.
             */
            destinationBalance.blockedQty = scale(
                    destinationBalance.blockedQty
                            .add(quantity));

            blockedAdded = quantity;

        } else if (hasSuccessor ||
                dispositionTransfer) {
            /*
             * Intermediate stock remains reserved for the next
             * route leg and cannot be allocated elsewhere.
             */
            destinationBalance.reservedQty = scale(
                    destinationBalance.reservedQty
                            .add(quantity));

            reservedAdded = quantity;
        }

        destinationBalance.setUpdatedBy(actor);

        destinationBalance = stockRepository.save(
                destinationBalance);

        if (qcDestination) {
            registerTransferQc(
                    transfer,
                    transferLine,
                    quantity,
                    actor);
        }

        transferLine.receivedQty = scale(
                transferLine.receivedQty
                        .add(quantity));

        transferLine.setUpdatedBy(actor);

        transferLineRepository.save(
                transferLine);

        boolean fullyReceived = transferLine.receivedQty
                .compareTo(
                        transferLine.plannedQty) >= 0;

        if (fullyReceived) {
            transfer.status = TransferStatus.RECEIVED;
        } else if (transferLine.receivedQty
                .compareTo(
                        transferLine.dispatchedQty) < 0) {
            transfer.status = TransferStatus.PARTIALLY_RECEIVED;
        } else {
            transfer.status = TransferStatus.PARTIALLY_DISPATCHED;
        }

        transfer.setUpdatedBy(actor);

        transfer = transferRepository.save(
                transfer);

        saveLedger(
                sourceBalance,
                MovementType.TRANSFER_RECEIPT_CLEAR,

                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                quantity.negate(),

                transfer,
                request == null
                        ? null
                        : request.batchNo(),
                "Transit quantity cleared on receipt",
                actor);

        saveLedger(
                destinationBalance,
                MovementType.TRANSFER_IN,

                quantity,
                reservedAdded,
                blockedAdded,
                BigDecimal.ZERO,

                transfer,
                request == null
                        ? null
                        : request.batchNo(),
                request == null
                        ? null
                        : request.remarks(),
                actor);

        if (fullyReceived) {
            boolean processingDestination = transfer.toLocation.locationType == LocationType.PROCESSING ||
                    transfer.toLocation.locationType == LocationType.EXTERNAL_PROCESSOR;

            qcDestination = transfer.toLocation.locationType == LocationType.QC;

            /*
             * Processing and QC must complete before the next
             * transfer leg can become Ready.
             */
            if (hasSuccessor &&
                    !processingDestination &&
                    !qcDestination) {
                activateSuccessor(
                        transfer,
                        actor);
            }

            if (!hasSuccessor &&
                    transfer.toLocation.locationType == LocationType.PRODUCTION) {
                recordProductionIssue(
                        transfer,
                        transferLine,
                        actor);
            }
        }

        return toResponse(transfer);
    }

    @Transactional
    public ReservationResponse issueDirectReservation(
            UUID reservationId,
            TransferActionRequest request) {
        MatFlowReservation reservation = reservationRepository
                .findById(reservationId)
                .orElseThrow(() -> notFound(
                        "Reservation not found"));

        if (transferRepository
                .existsByReservation_Id(
                        reservationId)) {
            throw conflict(
                    "Reservation has a transfer route and cannot be issued directly");
        }

        if (!reservation.sourceLocation
                .getId()
                .equals(
                        reservation.firstDestinationLocation
                                .getId())
                ||
                reservation.sourceLocation.locationType != LocationType.PRODUCTION) {
            throw conflict(
                    "Direct issue is only available when stock is already at the production destination");
        }

        accessService.requireTransferReceive(
                reservation.sourceLocation);

        assertVersion(
                request == null
                        ? null
                        : request.rowVersion(),
                reservation.getRowVersion(),
                "Reservation");

        if (reservation.status != ReservationStatus.ACTIVE) {
            throw conflict(
                    "Only an active reservation can be issued");
        }

        BigDecimal quantity = request != null &&
                request.quantity() != null
                        ? positiveQuantity(
                                request.quantity(),
                                reservation.reservedQty,
                                "Issue quantity")
                        : reservation.reservedQty;

        if (quantity.compareTo(
                reservation.reservedQty) != 0) {
            throw badRequest(
                    "Direct issue must issue the complete reservation");
        }

        MatFlowStockBalance balance = stockRepository
                .lockBalance(
                        reservation.material.getId(),
                        reservation.sourceLocation.getId())
                .orElseThrow(() -> conflict(
                        "Reserved production stock balance not found"));

        if (balance.reservedQty
                .compareTo(quantity) < 0) {
            throw conflict(
                    "Reserved stock is no longer available");
        }

        String actor = accessService.actor();

        balance.reservedQty = scale(
                balance.reservedQty
                        .subtract(quantity));

        balance.setUpdatedBy(actor);

        balance = stockRepository.save(balance);

        MatFlowRequisitionLine requisitionLine = reservation.requisitionLine;

        requisitionLine.issuedQty = scale(
                requisitionLine.issuedQty
                        .add(quantity));

        requisitionLine.setUpdatedBy(actor);

        requisitionLine.issuedMaterial = reservation.material;

        requisitionLineRepository.save(
                requisitionLine);

        reservation.status = ReservationStatus.ISSUED;

        reservation.setUpdatedBy(actor);

        reservation = reservationRepository.save(
                reservation);

        saveLedger(
                balance,
                MovementType.ISSUE_TO_PRODUCTION,

                BigDecimal.ZERO,
                quantity.negate(),
                BigDecimal.ZERO,
                BigDecimal.ZERO,

                null,
                request == null
                        ? null
                        : request.batchNo(),
                "Reserved stock handed over to production at the same location",
                actor);

        refreshRequisitionStatus(
                requisitionLine.requisition,
                actor);

        return new ReservationResponse(
                reservation.getId(),
                reservation.requisitionLine.getId(),
                reservation.material.getMaterialCode(),

                reservation.sourceLocation.getId(),
                reservation.sourceLocation.locationCode,
                reservation.sourceLocation.plantCode,

                reservation.firstDestinationLocation.getId(),
                reservation.firstDestinationLocation.locationCode,

                reservation.demandPlantCode,
                reservation.reservedQty,
                reservation.status,
                reservation.getRowVersion());
    }

    private void activateSuccessor(
            MatFlowTransferOrder transfer,
            String actor) {
        transferRepository
                .findByPredecessorTransferId(
                        transfer.getId())
                .ifPresent(successor -> {
                    if (successor.status == TransferStatus.PLANNED) {
                        successor.status = TransferStatus.READY;

                        successor.setUpdatedBy(actor);

                        transferRepository.save(
                                successor);
                    }
                });
    }

    private void recordProductionIssue(
            MatFlowTransferOrder transfer,
            MatFlowTransferLine transferLine,
            String actor) {
        MatFlowReservation reservation = transfer.reservation;

        MatFlowRequisitionLine requisitionLine = reservation.requisitionLine;

        BigDecimal totalReceived = transferLine.receivedQty;

        BigDecimal alreadyIssuedFromReservation = reservation.status == ReservationStatus.ISSUED
                ? reservation.reservedQty
                : BigDecimal.ZERO;

        BigDecimal issueNow = totalReceived
                .subtract(
                        alreadyIssuedFromReservation)
                .max(BigDecimal.ZERO);

        if (issueNow.compareTo(
                BigDecimal.ZERO) > 0) {
            requisitionLine.issuedQty = scale(
                    requisitionLine.issuedQty
                            .add(issueNow));

            requisitionLine.issuedMaterial = transferLine.material;

            requisitionLine.setUpdatedBy(actor);

            requisitionLineRepository.save(
                    requisitionLine);
        }

        reservation.status = ReservationStatus.ISSUED;

        reservation.setUpdatedBy(actor);

        reservationRepository.save(
                reservation);

        refreshRequisitionStatus(
                transfer.requisition,
                actor);
    }

    private void refreshRequisitionStatus(
            MatFlowMaterialRequisition requisition,
            String actor) {
        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                .findByRequisition_IdOrderByLineNoAsc(
                        requisition.getId());

        boolean allIssued = !lines.isEmpty() &&
                lines.stream()
                        .allMatch(line -> line.issuedQty
                                .compareTo(
                                        line.requestedQty) >= 0);

        if (allIssued) {
            requisition.status = RequisitionStatus.ISSUED;

            requisition.setUpdatedBy(actor);

            requisitionRepository.save(
                    requisition);
        }
    }

    private MatFlowStockBalance lockOrCreateDestinationBalance(
            MatFlowMaterial material,
            MatFlowLocation location,
            String actor) {
        MatFlowStockBalance existing = stockRepository
                .lockBalance(
                        material.getId(),
                        location.getId())
                .orElse(null);

        if (existing != null) {
            return existing;
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

    private void validatePredecessor(
            MatFlowTransferOrder transfer) {
        if (transfer.predecessorTransferId == null) {
            return;
        }

        MatFlowTransferOrder predecessor = transferRepository
                .findById(
                        transfer.predecessorTransferId)
                .orElseThrow(() -> conflict(
                        "Previous route transfer does not exist"));

        if (predecessor.status != TransferStatus.RECEIVED) {
            throw conflict(
                    "Previous route transfer must be fully received first");
        }
    }

    private MatFlowTransferOrder requireTransfer(
            UUID id) {
        return transferRepository
                .findById(id)
                .orElseThrow(() -> notFound(
                        "Transfer order not found"));
    }

    private MatFlowTransferOrder requireVisibleTransfer(
            UUID id) {
        MatFlowTransferOrder transfer = requireTransfer(id);

        if (!accessService.canAccessPlant(
                transfer.fromLocation.plantCode) &&
                !accessService.canAccessPlant(
                        transfer.toLocation.plantCode)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "No access to this transfer");
        }

        return transfer;
    }

    private MatFlowTransferLine requireTransferLine(
            UUID transferId) {
        return transferLineRepository
                .findFirstByTransferOrder_IdOrderByCreatedAtAsc(
                        transferId)
                .orElseThrow(() -> conflict(
                        "Transfer has no material line"));
    }

    private void saveLedger(
            MatFlowStockBalance balance,
            MovementType movementType,

            BigDecimal quantityChange,
            BigDecimal reservedChange,
            BigDecimal blockedChange,
            BigDecimal inTransitChange,

            MatFlowTransferOrder transfer,
            String batchNo,
            String remarks,
            String actor) {
        MatFlowStockLedger ledger = new MatFlowStockLedger();

        ledger.material = balance.material;

        ledger.location = balance.location;

        ledger.movementType = movementType;

        ledger.quantityChange = scale(quantityChange);

        ledger.reservedChange = scale(reservedChange);

        ledger.blockedChange = scale(blockedChange);

        ledger.inTransitChange = scale(inTransitChange);

        ledger.onHandAfter = balance.onHandQty;

        ledger.reservedAfter = balance.reservedQty;

        ledger.blockedAfter = balance.blockedQty;

        ledger.inTransitAfter = balance.inTransitQty;

        ledger.referenceType = transfer == null
                ? "MATFLOW_DIRECT_ISSUE"
                : "MATFLOW_TRANSFER";

        ledger.referenceId = transfer == null
                ? null
                : transfer.getId();

        ledger.referenceNumber = transfer == null
                ? null
                : transfer.transferNumber;

        if (transfer != null) {
            ledger.projectCode = transfer.requisition.projectDrawing
                    .getProjectCode();

            ledger.drawingNo = transfer.requisition.projectDrawing
                    .getDrawingNo();
        }

        ledger.batchNo = clean(batchNo);

        ledger.remarks = clean(remarks);

        ledger.actor = actor;

        ledgerRepository.save(ledger);
    }

    private TransferResponse toResponse(
            MatFlowTransferOrder transfer) {
        MatFlowTransferLine line = requireTransferLine(
                transfer.getId());

        return new TransferResponse(
                transfer.getId(),
                transfer.transferNumber,
                transfer.reservation.getId(),

                transfer.fromLocation.getId(),
                transfer.fromLocation.locationCode,
                transfer.fromLocation.plantCode,

                transfer.toLocation.getId(),
                transfer.toLocation.locationCode,
                transfer.toLocation.plantCode,

                transfer.routeSequenceNo,
                transfer.predecessorTransferId,

                transfer.purpose,
                transfer.status,

                line.material.getMaterialCode(),
                line.plannedQty,
                line.dispatchedQty,
                line.receivedQty,
                line.uom,

                transfer.getRowVersion());
    }

    private BigDecimal positiveQuantity(
            BigDecimal requested,
            BigDecimal maximum,
            String field) {
        if (requested == null ||
                requested.compareTo(
                        BigDecimal.ZERO) <= 0) {
            throw badRequest(
                    field +
                            " must be greater than zero");
        }

        BigDecimal quantity = scale(requested);

        if (quantity.compareTo(
                maximum) > 0) {
            throw conflict(
                    field +
                            " exceeds the outstanding quantity");
        }

        return quantity;
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
                            " was modified by another user. Refresh and retry.");
        }
    }

    private BigDecimal scale(
            BigDecimal value) {
        return value == null
                ? BigDecimal.ZERO
                : value.setScale(
                        3,
                        RoundingMode.HALF_UP);
    }

    private String clean(
            String value) {
        if (value == null) {
            return null;
        }

        String result = value.trim();

        return result.isBlank()
                ? null
                : result;
    }

    private String cleanUpper(
            String value) {
        String result = clean(value);

        return result == null
                ? null
                : result.toUpperCase();
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

    private void registerTransferQc(
            MatFlowTransferOrder transfer,
            MatFlowTransferLine transferLine,
            BigDecimal quantity,
            String actor) {
        MatFlowQcInspection inspection = qcRepository
                .findBySourceTypeAndSourceLineId(
                        QcSourceType.TRANSFER_RECEIPT,
                        transferLine.getId())
                .orElse(null);

        if (inspection == null) {
            inspection = new MatFlowQcInspection();

            inspection.inspectionNumber = "MFQ-" +
                    LocalDate.now().getYear() +
                    "-" +
                    UUID.randomUUID()
                            .toString()
                            .replace("-", "")
                            .substring(0, 8)
                            .toUpperCase();

            inspection.sourceType = QcSourceType.TRANSFER_RECEIPT;

            inspection.sourceId = transfer.getId();

            inspection.sourceLineId = transferLine.getId();

            inspection.material = transferLine.material;

            inspection.location = transfer.toLocation;

            inspection.inspectionQty = BigDecimal.ZERO;

            inspection.acceptedQty = BigDecimal.ZERO;

            inspection.rejectedQty = BigDecimal.ZERO;

            inspection.status = QcInspectionStatus.PENDING;

            inspection.setCreatedBy(actor);
        } else if (inspection.status != QcInspectionStatus.PENDING) {
            throw conflict(
                    "Additional material cannot be received after QC completion");
        }

        inspection.inspectionQty = scale(
                inspection.inspectionQty
                        .add(quantity));

        inspection.setUpdatedBy(actor);

        qcRepository.save(inspection);
    }
}