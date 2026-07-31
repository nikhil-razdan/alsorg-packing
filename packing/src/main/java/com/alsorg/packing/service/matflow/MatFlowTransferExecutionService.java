package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferResponse;

import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowQcInspection;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowTransferLine;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;

import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowQcInspectionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;

import java.time.LocalDate;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowTransferExecutionService {

        private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(
                        3,
                        RoundingMode.HALF_UP);

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

                String normalizedPlant = cleanUpper(plantCode);

                if (normalizedPlant != null) {
                        accessService.requirePlantAccess(
                                        normalizedPlant);
                }

                return transferRepository
                                .findAllByOrderByUpdatedAtDesc()
                                .stream()
                                .filter(transfer -> accessService.canAccessPlant(
                                                transfer.fromLocation
                                                                .getPlantCode())
                                                ||
                                                accessService.canAccessPlant(
                                                                transfer.toLocation
                                                                                .getPlantCode()))
                                .filter(transfer -> status == null ||
                                                transfer.status == status)
                                .filter(transfer -> normalizedPlant == null
                                                ||
                                                transfer.fromLocation
                                                                .getPlantCode()
                                                                .equalsIgnoreCase(
                                                                                normalizedPlant)
                                                ||
                                                transfer.toLocation
                                                                .getPlantCode()
                                                                .equalsIgnoreCase(
                                                                                normalizedPlant))
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

                MatFlowTransferOrder transfer = requireLockedTransfer(id);

                validateTransferLocations(
                                transfer);

                accessService.requireTransferDispatch(
                                transfer.fromLocation);

                if (!isDispatchableStatus(
                                transfer.status)) {

                        throw conflict(
                                        "Only a Ready, Partially Dispatched or " +
                                                        "Partially Received transfer can be dispatched");
                }

                assertVersion(
                                request == null
                                                ? null
                                                : request.rowVersion(),
                                transfer.getRowVersion(),
                                "Transfer");

                validatePredecessor(
                                transfer);

                MatFlowTransferLine transferLine = requireLockedTransferLine(
                                transfer.getId());

                validateTransferQuantities(
                                transferLine);

                BigDecimal remainingToDispatch = zero(transferLine.plannedQty)
                                .subtract(
                                                zero(
                                                                transferLine.dispatchedQty));

                BigDecimal quantity = positiveQuantity(
                                request == null
                                                ? null
                                                : request.quantity(),
                                remainingToDispatch,
                                "Dispatch quantity");

                MatFlowStockBalance sourceBalance = stockRepository
                                .lockBalance(
                                                transferLine.material
                                                                .getId(),
                                                transfer.fromLocation
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "No stock balance exists at the transfer source"));

                BigDecimal sourceReserved = zero(
                                sourceBalance.reservedQty);

                BigDecimal sourceOnHand = zero(
                                sourceBalance.onHandQty);

                BigDecimal sourceBlocked = zero(
                                sourceBalance.blockedQty);

                if (sourceReserved.compareTo(
                                quantity) < 0) {

                        throw conflict(
                                        "Insufficient reserved stock at source location");
                }

                BigDecimal usablePhysicalQty = sourceOnHand.subtract(
                                sourceBlocked);

                if (usablePhysicalQty.compareTo(
                                quantity) < 0) {

                        throw conflict(
                                        "Insufficient usable physical stock at source location");
                }

                String actor = accessService.actor();

                sourceBalance.onHandQty = scale(
                                sourceOnHand.subtract(
                                                quantity));

                sourceBalance.reservedQty = scale(
                                sourceReserved.subtract(
                                                quantity));

                sourceBalance.inTransitQty = scale(
                                zero(
                                                sourceBalance.inTransitQty)
                                                .add(quantity));

                sourceBalance.setUpdatedBy(
                                actor);

                sourceBalance = stockRepository.save(
                                sourceBalance);

                transferLine.dispatchedQty = scale(
                                zero(
                                                transferLine.dispatchedQty)
                                                .add(quantity));

                transferLine.setUpdatedBy(
                                actor);

                transferLineRepository.save(
                                transferLine);

                transfer.status = deriveTransferStatus(
                                transferLine);

                transfer.setUpdatedBy(
                                actor);

                transfer = transferRepository.save(
                                transfer);

                /*
                 * Do not change the reservation to RELEASED here.
                 *
                 * The reservation remains ACTIVE throughout the route.
                 * It becomes ISSUED only after the final Production
                 * destination receives the complete reserved quantity.
                 */

                saveTransferLedger(
                                sourceBalance,
                                MovementType.TRANSFER_OUT,

                                quantity.negate(),
                                quantity.negate(),
                                ZERO,
                                quantity,

                                transfer,

                                request == null
                                                ? null
                                                : request.batchNo(),

                                request == null
                                                ? null
                                                : request.remarks(),

                                actor);

                auditService.record(
                                "TRANSFER",
                                transfer.getId(),
                                "TRANSFER_DISPATCHED",
                                transfer.fromLocation
                                                .getPlantCode(),
                                transfer.requisition.projectDrawing
                                                .getProjectCode(),
                                transfer.requisition.projectDrawing
                                                .getDrawingNo(),
                                auditService.details(
                                                "transferNumber",
                                                transfer.transferNumber,

                                                "fromLocation",
                                                transfer.fromLocation
                                                                .getLocationCode(),

                                                "toLocation",
                                                transfer.toLocation
                                                                .getLocationCode(),

                                                "quantity",
                                                quantity,

                                                "dispatchedQty",
                                                transferLine.dispatchedQty,

                                                "status",
                                                transfer.status));

                return toResponse(
                                transfer);
        }

        @Transactional
        public TransferResponse receive(
                        UUID id,
                        TransferActionRequest request) {

                MatFlowTransferOrder transfer = requireLockedTransfer(id);

                validateTransferLocations(
                                transfer);

                accessService.requireTransferReceive(
                                transfer.toLocation);

                if (!isReceivableStatus(
                                transfer.status)) {

                        throw conflict(
                                        "Transfer is not available for receipt");
                }

                assertVersion(
                                request == null
                                                ? null
                                                : request.rowVersion(),
                                transfer.getRowVersion(),
                                "Transfer");

                MatFlowTransferLine transferLine = requireLockedTransferLine(
                                transfer.getId());

                validateTransferQuantities(
                                transferLine);

                BigDecimal outstandingReceipt = zero(
                                transferLine.dispatchedQty)
                                .subtract(
                                                zero(
                                                                transferLine.receivedQty));

                BigDecimal quantity = positiveQuantity(
                                request == null
                                                ? null
                                                : request.quantity(),
                                outstandingReceipt,
                                "Received quantity");

                String actor = accessService.actor();

                MatFlowStockBalance sourceBalance = stockRepository
                                .lockBalance(
                                                transferLine.material
                                                                .getId(),
                                                transfer.fromLocation
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Source stock balance was not found"));

                BigDecimal sourceTransit = zero(
                                sourceBalance.inTransitQty);

                if (sourceTransit.compareTo(
                                quantity) < 0) {

                        throw conflict(
                                        "Received quantity exceeds the source in-transit quantity");
                }

                sourceBalance.inTransitQty = scale(
                                sourceTransit.subtract(
                                                quantity));

                sourceBalance.setUpdatedBy(
                                actor);

                sourceBalance = stockRepository.save(
                                sourceBalance);

                MatFlowStockBalance destinationBalance = lockOrCreateDestinationBalance(
                                transferLine.material,
                                transfer.toLocation,
                                actor);

                destinationBalance.onHandQty = scale(
                                zero(
                                                destinationBalance.onHandQty)
                                                .add(quantity));

                boolean qcDestination = transfer.toLocation
                                .getLocationType() == LocationType.QC;

                boolean processingDestination = transfer.toLocation
                                .getLocationType() == LocationType.PROCESSING
                                ||
                                transfer.toLocation
                                                .getLocationType() == LocationType.EXTERNAL_PROCESSOR;

                boolean hasSuccessor = transferRepository
                                .existsByPredecessorTransferId(
                                                transfer.getId());

                boolean dispositionTransfer = transfer.purpose == TransferPurpose.QC_TO_REWORK
                                ||
                                transfer.purpose == TransferPurpose.RETURN_TO_SOURCE;

                BigDecimal blockedAdded = ZERO;

                BigDecimal reservedAdded = ZERO;

                if (qcDestination) {
                        destinationBalance.blockedQty = scale(
                                        zero(
                                                        destinationBalance.blockedQty)
                                                        .add(quantity));

                        blockedAdded = quantity;

                } else if (hasSuccessor ||
                                dispositionTransfer) {

                        destinationBalance.reservedQty = scale(
                                        zero(
                                                        destinationBalance.reservedQty)
                                                        .add(quantity));

                        reservedAdded = quantity;
                }

                destinationBalance.setUpdatedBy(
                                actor);

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
                                zero(
                                                transferLine.receivedQty)
                                                .add(quantity));

                transferLine.setUpdatedBy(
                                actor);

                transferLineRepository.save(
                                transferLine);

                transfer.status = deriveTransferStatus(
                                transferLine);

                boolean fullyReceived = transfer.status == TransferStatus.RECEIVED;

                transfer.setUpdatedBy(
                                actor);

                transfer = transferRepository.save(
                                transfer);

                saveTransferLedger(
                                sourceBalance,
                                MovementType.TRANSFER_RECEIPT_CLEAR,

                                ZERO,
                                ZERO,
                                ZERO,
                                quantity.negate(),

                                transfer,

                                request == null
                                                ? null
                                                : request.batchNo(),

                                "Transit quantity cleared on receipt",

                                actor);

                saveTransferLedger(
                                destinationBalance,
                                MovementType.TRANSFER_IN,

                                quantity,
                                reservedAdded,
                                blockedAdded,
                                ZERO,

                                transfer,

                                request == null
                                                ? null
                                                : request.batchNo(),

                                request == null
                                                ? null
                                                : request.remarks(),

                                actor);

                /*
                 * A partial Production receipt is also a partial issue.
                 * Do not wait for the complete transfer before updating
                 * requisition-line issuedQty.
                 */
                if (!hasSuccessor &&
                                transfer.toLocation
                                                .getLocationType() == LocationType.PRODUCTION) {

                        recordProductionIssue(
                                        transfer,
                                        transferLine,
                                        destinationBalance,
                                        quantity,
                                        fullyReceived,
                                        actor);
                }

                if (fullyReceived &&
                                hasSuccessor &&
                                !processingDestination &&
                                !qcDestination) {

                        activateSuccessor(
                                        transfer,
                                        actor);
                }

                auditService.record(
                                "TRANSFER",
                                transfer.getId(),
                                "TRANSFER_RECEIVED",
                                transfer.toLocation
                                                .getPlantCode(),
                                transfer.requisition.projectDrawing
                                                .getProjectCode(),
                                transfer.requisition.projectDrawing
                                                .getDrawingNo(),
                                auditService.details(
                                                "transferNumber",
                                                transfer.transferNumber,

                                                "fromLocation",
                                                transfer.fromLocation
                                                                .getLocationCode(),

                                                "toLocation",
                                                transfer.toLocation
                                                                .getLocationCode(),

                                                "quantity",
                                                quantity,

                                                "receivedQty",
                                                transferLine.receivedQty,

                                                "status",
                                                transfer.status));

                return toResponse(
                                transfer);
        }

        @Transactional
        public ReservationResponse issueDirectReservation(
                        UUID reservationId,
                        TransferActionRequest request) {

                MatFlowReservation reservation = reservationRepository
                                .lockById(
                                                reservationId)
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
                                reservation.sourceLocation
                                                .getLocationType() != LocationType.PRODUCTION) {

                        throw conflict(
                                        "Direct issue is only available when stock is already at the Production destination");
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

                BigDecimal reservationQuantity = zero(
                                reservation.reservedQty);

                BigDecimal quantity = request != null &&
                                request.quantity() != null
                                                ? positiveQuantity(
                                                                request.quantity(),
                                                                reservationQuantity,
                                                                "Issue quantity")
                                                : reservationQuantity;

                if (quantity.compareTo(
                                reservationQuantity) != 0) {

                        throw badRequest(
                                        "Direct issue must issue the complete reservation");
                }

                MatFlowStockBalance balance = stockRepository
                                .lockBalance(
                                                reservation.material
                                                                .getId(),
                                                reservation.sourceLocation
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Reserved Production stock balance was not found"));

                if (zero(
                                balance.reservedQty)
                                .compareTo(
                                                quantity) < 0) {

                        throw conflict(
                                        "Reserved stock is no longer available");
                }

                MatFlowRequisitionLine requisitionLine = requisitionLineRepository
                                .lockById(
                                                reservation.requisitionLine
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Requisition line was not found"));

                String actor = accessService.actor();

                balance.reservedQty = scale(
                                zero(
                                                balance.reservedQty)
                                                .subtract(quantity));

                balance.setUpdatedBy(
                                actor);

                balance = stockRepository.save(
                                balance);

                BigDecimal nextIssuedQty = zero(
                                requisitionLine.issuedQty)
                                .add(quantity);

                if (nextIssuedQty.compareTo(
                                zero(
                                                requisitionLine.requestedQty)) > 0) {

                        throw conflict(
                                        "Issued quantity would exceed the requested quantity");
                }

                requisitionLine.issuedQty = scale(
                                nextIssuedQty);

                requisitionLine.issuedMaterial = reservation.material;

                requisitionLine.setUpdatedBy(
                                actor);

                requisitionLineRepository.save(
                                requisitionLine);

                reservation.status = ReservationStatus.ISSUED;

                reservation.setUpdatedBy(
                                actor);

                reservation = reservationRepository.save(
                                reservation);

                saveDirectIssueLedger(
                                balance,
                                reservation,
                                quantity,

                                request == null
                                                ? null
                                                : request.batchNo(),

                                request == null
                                                ? null
                                                : request.remarks(),

                                actor);

                auditService.record(
                                "RESERVATION",
                                reservation.getId(),
                                "DIRECT_ISSUE_TO_PRODUCTION",
                                reservation.sourceLocation
                                                .getPlantCode(),
                                reservation.requisitionLine.requisition.projectDrawing
                                                .getProjectCode(),
                                reservation.requisitionLine.requisition.projectDrawing
                                                .getDrawingNo(),
                                auditService.details(
                                                "materialCode",
                                                reservation.material
                                                                .getMaterialCode(),

                                                "location",
                                                reservation.sourceLocation
                                                                .getLocationCode(),

                                                "quantity",
                                                quantity));

                refreshRequisitionStatus(
                                requisitionLine.requisition,
                                actor);

                return toReservationResponse(
                                reservation);
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

                                                successor.setUpdatedBy(
                                                                actor);

                                                transferRepository.save(
                                                                successor);

                                                auditService.record(
                                                                "TRANSFER",
                                                                successor.getId(),
                                                                "TRANSFER_READY",
                                                                successor.fromLocation
                                                                                .getPlantCode(),
                                                                successor.requisition.projectDrawing
                                                                                .getProjectCode(),
                                                                successor.requisition.projectDrawing
                                                                                .getDrawingNo(),
                                                                auditService.details(
                                                                                "transferNumber",
                                                                                successor.transferNumber,

                                                                                "predecessorTransferId",
                                                                                transfer.getId(),

                                                                                "fromLocation",
                                                                                successor.fromLocation
                                                                                                .getLocationCode(),

                                                                                "toLocation",
                                                                                successor.toLocation
                                                                                                .getLocationCode()));
                                        }
                                });
        }

        private void recordProductionIssue(
                        MatFlowTransferOrder transfer,
                        MatFlowTransferLine transferLine,
                        MatFlowStockBalance productionBalance,
                        BigDecimal quantity,
                        boolean fullyReceived,
                        String actor) {

                MatFlowReservation reservation = reservationRepository
                                .lockById(
                                                transfer.reservation
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Transfer reservation was not found"));

                MatFlowRequisitionLine requisitionLine = requisitionLineRepository
                                .lockById(
                                                reservation.requisitionLine
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Transfer requisition line was not found"));

                BigDecimal nextIssuedQty = zero(
                                requisitionLine.issuedQty)
                                .add(quantity);

                if (nextIssuedQty.compareTo(
                                zero(
                                                requisitionLine.requestedQty)) > 0) {

                        throw conflict(
                                        "Production issue would exceed the requested quantity");
                }

                requisitionLine.issuedQty = scale(
                                nextIssuedQty);

                requisitionLine.issuedMaterial = transferLine.material;

                requisitionLine.setUpdatedBy(
                                actor);

                requisitionLineRepository.save(
                                requisitionLine);

                /*
                 * Keep the reservation active after a partial Production
                 * receipt. It becomes ISSUED only once the complete final
                 * transfer has been received.
                 */
                if (fullyReceived) {
                        reservation.status = ReservationStatus.ISSUED;

                        reservation.setUpdatedBy(
                                        actor);

                        reservationRepository.save(
                                        reservation);
                }

                saveTransferLedger(
                                productionBalance,
                                MovementType.ISSUE_TO_PRODUCTION,

                                ZERO,
                                ZERO,
                                ZERO,
                                ZERO,

                                transfer,
                                null,

                                "Issued to Production: " +
                                                quantity.toPlainString() +
                                                " " +
                                                transferLine.uom,

                                actor);

                refreshRequisitionStatus(
                                requisitionLine.requisition,
                                actor);
        }

        private void refreshRequisitionStatus(
                        MatFlowMaterialRequisition requisition,
                        String actor) {

                MatFlowMaterialRequisition current = requisitionRepository
                                .findById(
                                                requisition.getId())
                                .orElseThrow(() -> notFound(
                                                "Requisition not found"));

                if (current.status == RequisitionStatus.CANCELLED ||
                                current.status == RequisitionStatus.COMPLETED) {

                        return;
                }

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                current.getId());

                boolean allIssued = !lines.isEmpty() &&
                                lines.stream()
                                                .allMatch(line -> zero(
                                                                line.issuedQty)
                                                                .compareTo(
                                                                                zero(
                                                                                                line.requestedQty)) >= 0);

                if (allIssued &&
                                current.status != RequisitionStatus.ISSUED) {

                        current.status = RequisitionStatus.ISSUED;

                        current.setUpdatedBy(
                                        actor);

                        requisitionRepository.save(
                                        current);
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

                created.onHandQty = ZERO;

                created.reservedQty = ZERO;

                created.blockedQty = ZERO;

                created.inTransitQty = ZERO;

                created.setCreatedBy(
                                actor);

                created.setUpdatedBy(
                                actor);

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

        private void validateTransferLocations(
                        MatFlowTransferOrder transfer) {

                if (transfer.fromLocation == null ||
                                transfer.toLocation == null) {

                        throw conflict(
                                        "Transfer source or destination is missing");
                }

                if (transfer.fromLocation
                                .getId()
                                .equals(
                                                transfer.toLocation
                                                                .getId())) {

                        throw conflict(
                                        "Transfer source and destination cannot be the same");
                }

                if (!transfer.fromLocation
                                .isActive()) {

                        throw conflict(
                                        "Transfer source location is inactive");
                }

                if (!transfer.toLocation
                                .isActive()) {

                        throw conflict(
                                        "Transfer destination location is inactive");
                }

                if (!transfer.fromLocation
                                .isSupportsStock()) {

                        throw conflict(
                                        "Transfer source does not support stock");
                }

                if (!transfer.toLocation
                                .isSupportsStock()) {

                        throw conflict(
                                        "Transfer destination does not support stock");
                }
        }

        private void validateTransferQuantities(
                        MatFlowTransferLine line) {

                BigDecimal planned = zero(
                                line.plannedQty);

                BigDecimal dispatched = zero(
                                line.dispatchedQty);

                BigDecimal received = zero(
                                line.receivedQty);

                if (planned.compareTo(
                                ZERO) <= 0) {

                        throw conflict(
                                        "Transfer planned quantity must be greater than zero");
                }

                if (dispatched.compareTo(
                                ZERO) < 0 ||
                                dispatched.compareTo(
                                                planned) > 0) {

                        throw conflict(
                                        "Transfer dispatched quantity is inconsistent");
                }

                if (received.compareTo(
                                ZERO) < 0 ||
                                received.compareTo(
                                                dispatched) > 0) {

                        throw conflict(
                                        "Transfer received quantity is inconsistent");
                }
        }

        private TransferStatus deriveTransferStatus(
                        MatFlowTransferLine line) {

                BigDecimal planned = zero(
                                line.plannedQty);

                BigDecimal dispatched = zero(
                                line.dispatchedQty);

                BigDecimal received = zero(
                                line.receivedQty);

                if (received.compareTo(
                                planned) >= 0) {

                        return TransferStatus.RECEIVED;
                }

                if (received.compareTo(
                                ZERO) > 0) {

                        return TransferStatus.PARTIALLY_RECEIVED;
                }

                if (dispatched.compareTo(
                                planned) >= 0) {

                        return TransferStatus.IN_TRANSIT;
                }

                if (dispatched.compareTo(
                                ZERO) > 0) {

                        return TransferStatus.PARTIALLY_DISPATCHED;
                }

                return TransferStatus.READY;
        }

        private boolean isDispatchableStatus(
                        TransferStatus status) {

                return status == TransferStatus.READY
                                ||
                                status == TransferStatus.PARTIALLY_DISPATCHED
                                ||
                                status == TransferStatus.PARTIALLY_RECEIVED;
        }

        private boolean isReceivableStatus(
                        TransferStatus status) {

                return status == TransferStatus.IN_TRANSIT
                                ||
                                status == TransferStatus.PARTIALLY_DISPATCHED
                                ||
                                status == TransferStatus.PARTIALLY_RECEIVED;
        }

        private MatFlowTransferOrder requireLockedTransfer(
                        UUID id) {

                return transferRepository
                                .lockById(
                                                id)
                                .orElseThrow(() -> notFound(
                                                "Transfer order not found"));
        }

        private MatFlowTransferOrder requireTransfer(
                        UUID id) {

                return transferRepository
                                .findById(
                                                id)
                                .orElseThrow(() -> notFound(
                                                "Transfer order not found"));
        }

        private MatFlowTransferOrder requireVisibleTransfer(
                        UUID id) {

                MatFlowTransferOrder transfer = requireTransfer(id);

                if (!accessService.canAccessPlant(
                                transfer.fromLocation
                                                .getPlantCode())
                                &&
                                !accessService.canAccessPlant(
                                                transfer.toLocation
                                                                .getPlantCode())) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "No access to this transfer");
                }

                return transfer;
        }

        private MatFlowTransferLine requireLockedTransferLine(
                        UUID transferId) {

                List<MatFlowTransferLine> lines = transferLineRepository
                                .lockByTransferOrderId(
                                                transferId);

                return requireSingleTransferLine(
                                lines);
        }

        private MatFlowTransferLine requireTransferLine(
                        UUID transferId) {

                List<MatFlowTransferLine> lines = transferLineRepository
                                .findByTransferOrder_IdOrderByCreatedAtAsc(
                                                transferId);

                return requireSingleTransferLine(
                                lines);
        }

        private MatFlowTransferLine requireSingleTransferLine(
                        List<MatFlowTransferLine> lines) {

                if (lines == null ||
                                lines.isEmpty()) {

                        throw conflict(
                                        "Transfer has no material line");
                }

                if (lines.size() != 1) {
                        throw conflict(
                                        "Transfer must contain exactly one material line");
                }

                return lines.get(0);
        }

        private void saveTransferLedger(
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

                ledger.quantityChange = scale(
                                quantityChange);

                ledger.reservedChange = scale(
                                reservedChange);

                ledger.blockedChange = scale(
                                blockedChange);

                ledger.inTransitChange = scale(
                                inTransitChange);

                ledger.onHandAfter = zero(
                                balance.onHandQty);

                ledger.reservedAfter = zero(
                                balance.reservedQty);

                ledger.blockedAfter = zero(
                                balance.blockedQty);

                ledger.inTransitAfter = zero(
                                balance.inTransitQty);

                ledger.referenceType = "MATFLOW_TRANSFER";

                ledger.referenceId = transfer.getId();

                ledger.referenceNumber = transfer.transferNumber;

                ledger.projectCode = transfer.requisition.projectDrawing
                                .getProjectCode();

                ledger.drawingNo = transfer.requisition.projectDrawing
                                .getDrawingNo();

                ledger.batchNo = clean(
                                batchNo);

                ledger.remarks = clean(
                                remarks);

                ledger.actor = actor;

                ledgerRepository.save(
                                ledger);
        }

        private void saveDirectIssueLedger(
                        MatFlowStockBalance balance,
                        MatFlowReservation reservation,
                        BigDecimal quantity,
                        String batchNo,
                        String remarks,
                        String actor) {

                MatFlowStockLedger ledger = new MatFlowStockLedger();

                ledger.material = balance.material;

                ledger.location = balance.location;

                ledger.movementType = MovementType.ISSUE_TO_PRODUCTION;

                ledger.quantityChange = ZERO;

                ledger.reservedChange = quantity.negate();

                ledger.blockedChange = ZERO;

                ledger.inTransitChange = ZERO;

                ledger.onHandAfter = zero(
                                balance.onHandQty);

                ledger.reservedAfter = zero(
                                balance.reservedQty);

                ledger.blockedAfter = zero(
                                balance.blockedQty);

                ledger.inTransitAfter = zero(
                                balance.inTransitQty);

                ledger.referenceType = "MATFLOW_RESERVATION";

                ledger.referenceId = reservation.getId();

                ledger.referenceNumber = reservation.requisitionLine.requisition.requisitionNumber;

                ledger.projectCode = reservation.requisitionLine.requisition.projectDrawing
                                .getProjectCode();

                ledger.drawingNo = reservation.requisitionLine.requisition.projectDrawing
                                .getDrawingNo();

                ledger.batchNo = clean(
                                batchNo);

                ledger.remarks = clean(remarks) == null
                                ? "Direct issue to Production: " +
                                                quantity.toPlainString()
                                : clean(remarks);

                ledger.actor = actor;

                ledgerRepository.save(
                                ledger);
        }

        private TransferResponse toResponse(
                        MatFlowTransferOrder transfer) {

                MatFlowTransferLine line = requireTransferLine(
                                transfer.getId());

                return new TransferResponse(
                                transfer.getId(),
                                transfer.transferNumber,

                                transfer.reservation
                                                .getId(),

                                transfer.reservation.requisitionLine == null
                                                ? null
                                                : transfer.reservation.requisitionLine
                                                                .getId(),

                                transfer.fromLocation
                                                .getId(),

                                transfer.fromLocation
                                                .getLocationCode(),

                                transfer.fromLocation
                                                .getPlantCode(),

                                transfer.toLocation
                                                .getId(),

                                transfer.toLocation
                                                .getLocationCode(),

                                transfer.toLocation
                                                .getPlantCode(),

                                transfer.routeSequenceNo,
                                transfer.predecessorTransferId,

                                transfer.purpose,
                                transfer.status,

                                line.material
                                                .getId(),

                                line.material
                                                .getMaterialCode(),

                                line.material
                                                .getMaterialName(),

                                zero(
                                                line.plannedQty),

                                zero(
                                                line.dispatchedQty),

                                zero(
                                                line.receivedQty),

                                line.uom,

                                transfer.getRowVersion());
        }

        private ReservationResponse toReservationResponse(
                        MatFlowReservation reservation) {

                return new ReservationResponse(
                                reservation.getId(),

                                reservation.requisitionLine
                                                .getId(),

                                reservation.material
                                                .getMaterialCode(),

                                reservation.sourceLocation
                                                .getId(),

                                reservation.sourceLocation
                                                .getLocationCode(),

                                reservation.sourceLocation
                                                .getPlantCode(),

                                reservation.firstDestinationLocation
                                                .getId(),

                                reservation.firstDestinationLocation
                                                .getLocationCode(),

                                reservation.demandPlantCode,

                                zero(
                                                reservation.reservedQty),

                                reservation.status,

                                reservation.getRowVersion());
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

                BigDecimal quantity = scale(
                                requested);

                BigDecimal safeMaximum = scale(
                                maximum);

                if (safeMaximum.compareTo(
                                ZERO) <= 0) {

                        throw conflict(
                                        "No outstanding quantity remains");
                }

                if (quantity.compareTo(
                                safeMaximum) > 0) {

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

                if (!requested.equals(
                                current)) {

                        throw conflict(
                                        entity +
                                                        " was modified by another user. Refresh and retry.");
                }
        }

        private BigDecimal zero(
                        BigDecimal value) {

                return value == null
                                ? ZERO
                                : value.setScale(
                                                3,
                                                RoundingMode.HALF_UP);
        }

        private BigDecimal scale(
                        BigDecimal value) {

                return value == null
                                ? ZERO
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

                String result = clean(
                                value);

                return result == null
                                ? null
                                : result.toUpperCase(
                                                Locale.ROOT);
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
                                        LocalDate.now()
                                                        .getYear()
                                        +
                                        "-" +
                                        UUID.randomUUID()
                                                        .toString()
                                                        .replace(
                                                                        "-",
                                                                        "")
                                                        .substring(
                                                                        0,
                                                                        8)
                                                        .toUpperCase(
                                                                        Locale.ROOT);

                        inspection.sourceType = QcSourceType.TRANSFER_RECEIPT;

                        inspection.sourceId = transfer.getId();

                        inspection.sourceLineId = transferLine.getId();

                        inspection.material = transferLine.material;

                        inspection.location = transfer.toLocation;

                        inspection.inspectionQty = ZERO;

                        inspection.acceptedQty = ZERO;

                        inspection.rejectedQty = ZERO;

                        inspection.status = QcInspectionStatus.PENDING;

                        inspection.setCreatedBy(
                                        actor);

                } else if (inspection.status != QcInspectionStatus.PENDING) {

                        throw conflict(
                                        "Additional material cannot be received after QC completion");
                }

                inspection.inspectionQty = scale(
                                zero(
                                                inspection.inspectionQty)
                                                .add(quantity));

                inspection.setUpdatedBy(
                                actor);

                qcRepository.save(
                                inspection);
        }
}