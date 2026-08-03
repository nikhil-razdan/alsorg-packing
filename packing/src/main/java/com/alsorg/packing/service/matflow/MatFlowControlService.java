package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;
import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowProcessingJobRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowControlService {

        private final MatFlowReservationRepository reservationRepository;
        private final MatFlowMaterialRequisitionRepository requisitionRepository;
        private final MatFlowRequisitionLineRepository requisitionLineRepository;
        private final MatFlowStockBalanceRepository stockRepository;
        private final MatFlowStockLedgerRepository ledgerRepository;
        private final MatFlowTransferOrderRepository transferRepository;
        private final MatFlowProcessingJobRepository processingRepository;
        private final MatFlowIndentRepository indentRepository;
        private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
        private final MatFlowPlanningService planningService;
        private final MatFlowAccessService accessService;
        private final MatFlowIndentLineRepository indentLineRepository;

        public MatFlowControlService(
                        MatFlowReservationRepository reservationRepository,
                        MatFlowMaterialRequisitionRepository requisitionRepository,
                        MatFlowRequisitionLineRepository requisitionLineRepository,
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowTransferOrderRepository transferRepository,
                        MatFlowProcessingJobRepository processingRepository,
                        MatFlowIndentRepository indentRepository,
                        MatFlowPurchaseOrderRepository purchaseOrderRepository,
                        MatFlowPlanningService planningService,
                        MatFlowAccessService accessService,
                        MatFlowIndentLineRepository indentLineRepository) {
                this.reservationRepository = reservationRepository;

                this.requisitionRepository = requisitionRepository;

                this.requisitionLineRepository = requisitionLineRepository;

                this.stockRepository = stockRepository;

                this.ledgerRepository = ledgerRepository;

                this.transferRepository = transferRepository;

                this.processingRepository = processingRepository;

                this.indentRepository = indentRepository;

                this.purchaseOrderRepository = purchaseOrderRepository;

                this.planningService = planningService;

                this.accessService = accessService;

                this.indentLineRepository = indentLineRepository;
        }

        @Transactional
        public ReservationResponse releaseReservation(
                        UUID reservationId,
                        ReservationReleaseRequest request) {
                accessService.requireReservationRelease();

                MatFlowReservation reservation = reservationRepository
                                .lockById(
                                                reservationId)
                                .orElseThrow(() -> notFound(
                                                "Reservation not found"));

                accessService.requirePlantAccess(
                                reservation.sourceLocation
                                                .getPlantCode());

                if (request == null ||
                                clean(request.reason()) == null) {
                        throw badRequest(
                                        "Reservation release reason is required");
                }

                assertVersion(
                                request.rowVersion(),
                                reservation.getRowVersion(),
                                "Reservation");

                releaseReservationInternal(
                                reservation,
                                request.reason(),
                                accessService.actor());

                return toReservationResponse(
                                reservation);
        }

        @Transactional
        public RequisitionResponse cancelRequisition(
                        UUID requisitionId,
                        RequisitionCancelRequest request) {
                accessService.requireRequisitionCancel();

                MatFlowMaterialRequisition requisition = requisitionRepository
                                .findById(requisitionId)
                                .orElseThrow(() -> notFound(
                                                "Requisition not found"));

                accessService.requirePlantAccess(
                                requisition.destinationLocation.getPlantCode());

                if (request == null ||
                                clean(request.reason()) == null) {
                        throw badRequest(
                                        "Cancellation reason is required");
                }

                assertVersion(
                                request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                if (requisition.status == RequisitionStatus.ISSUED ||
                                requisition.status == RequisitionStatus.ISSUED_TO_PRODUCTION ||
                                requisition.status == RequisitionStatus.PRODUCTION_STARTED ||
                                requisition.status == RequisitionStatus.PRODUCTION_COMPLETED ||
                                requisition.status == RequisitionStatus.COMPLETED ||
                                requisition.status == RequisitionStatus.CANCELLED) {
                        throw conflict(
                                        "Issued, completed or cancelled requisitions cannot be cancelled");
                }

                ensureNoPhysicalExecution(
                                requisition);

                String actor = accessService.actor();

                List<MatFlowReservation> reservations = reservationRepository
                                .findByRequisitionLine_Requisition_IdAndStatus(
                                                requisition.getId(),
                                                ReservationStatus.ACTIVE);

                for (MatFlowReservation reservation : reservations) {
                        releaseReservationInternal(
                                        reservation,
                                        "Requisition cancelled: " +
                                                        request.reason(),
                                        actor);
                }

                List<MatFlowTransferOrder> transfers = transferRepository
                                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                                requisition.getId());

                for (MatFlowTransferOrder transfer : transfers) {
                        if (transfer.status == TransferStatus.PLANNED ||
                                        transfer.status == TransferStatus.READY) {
                                transfer.status = TransferStatus.CANCELLED;

                                transfer.setUpdatedBy(actor);

                                transferRepository.save(
                                                transfer);
                        }
                }

                List<MatFlowIndent> indents = indentRepository
                                .findByRequisition_Id(
                                                requisition.getId());

                for (MatFlowIndent indent : indents) {
                        indent.status = IndentStatus.CANCELLED;

                        indent.setUpdatedBy(actor);

                        indentRepository.save(indent);
                }

                requisition.status = RequisitionStatus.CANCELLED;

                requisition.cancelledBy = actor;

                requisition.cancelledAt = LocalDateTime.now();

                requisition.cancellationReason = clean(request.reason());

                requisition.setUpdatedBy(actor);

                requisitionRepository.save(
                                requisition);

                return planningService.getRequisition(
                                requisition.getId());
        }

        private void releaseReservationInternal(
                        MatFlowReservation reservation,
                        String reason,
                        String actor) {

                boolean releasable = reservation.status == ReservationStatus.ACTIVE ||
                                reservation.status == ReservationStatus.PARTIALLY_ISSUED;

                if (!releasable) {
                        throw conflict(
                                        "Only an active or partially issued reservation can be released");
                }

                BigDecimal reservedQty = scale(
                                reservation.reservedQty);

                BigDecimal issuedQty = scale(
                                reservation.issuedQty);

                BigDecimal remainingReservedQty = reservedQty
                                .subtract(
                                                issuedQty)
                                .max(
                                                BigDecimal.ZERO)
                                .setScale(
                                                3,
                                                RoundingMode.HALF_UP);

                if (remainingReservedQty.compareTo(
                                BigDecimal.ZERO) <= 0) {

                        throw conflict(
                                        "Reservation has no unissued quantity remaining to release");
                }

                if (reservation.status != ReservationStatus.ACTIVE) {
                        throw conflict(
                                        "Only an active reservation can be released");
                }

                List<MatFlowTransferOrder> transfers = transferRepository
                                .findByReservation_IdOrderByRouteSequenceNoAsc(
                                                reservation.getId());

                boolean physicallyStarted = transfers.stream()
                                .anyMatch(transfer -> transfer.status != TransferStatus.PLANNED &&
                                                transfer.status != TransferStatus.READY &&
                                                transfer.status != TransferStatus.CANCELLED);

                if (physicallyStarted) {
                        throw conflict(
                                        "Reservation cannot be released after transfer dispatch");
                }

                List<MatFlowProcessingJob> jobs = processingRepository
                                .findByReservation_Id(
                                                reservation.getId());

                boolean processingStarted = jobs.stream()
                                .anyMatch(job -> job.status != ProcessingJobStatus.PENDING &&
                                                job.status != ProcessingJobStatus.CANCELLED);

                if (processingStarted) {
                        throw conflict(
                                        "Reservation cannot be released after processing has started");
                }

                MatFlowStockBalance balance = stockRepository
                                .lockBalance(
                                                reservation.material
                                                                .getId(),
                                                reservation.sourceLocation
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Reserved stock balance was not found"));

                if (scale(
                                balance.reservedQty)
                                .compareTo(
                                                remainingReservedQty) < 0) {

                        throw conflict(
                                        "Stock reservation balance is inconsistent");
                }

                balance.reservedQty = scale(
                                scale(
                                                balance.reservedQty)
                                                .subtract(
                                                                remainingReservedQty));

                balance.setUpdatedBy(actor);

                balance = stockRepository.save(balance);

                MatFlowRequisitionLine requisitionLine = reservation.requisitionLine;

                requisitionLine.reservedQty = scale(
                                scale(
                                                requisitionLine.reservedQty)
                                                .subtract(
                                                                remainingReservedQty)
                                                .max(
                                                                BigDecimal.ZERO));

                requisitionLine.shortageQty = scale(
                                scale(
                                                requisitionLine.shortageQty)
                                                .add(
                                                                remainingReservedQty));

                ensureShortageIndent(
                                requisitionLine,
                                remainingReservedQty,
                                actor);

                requisitionLine.setUpdatedBy(actor);

                requisitionLineRepository.save(
                                requisitionLine);

                reservation.status = ReservationStatus.RELEASED;

                reservation.setUpdatedBy(actor);

                reservationRepository.save(
                                reservation);

                for (MatFlowTransferOrder transfer : transfers) {
                        if (transfer.status == TransferStatus.PLANNED ||
                                        transfer.status == TransferStatus.READY) {
                                transfer.status = TransferStatus.CANCELLED;

                                transfer.setUpdatedBy(actor);

                                transferRepository.save(
                                                transfer);
                        }
                }

                saveReleaseLedger(
                                balance,
                                reservation,
                                remainingReservedQty,
                                reason,
                                actor);

                MatFlowMaterialRequisition requisition = requisitionLine.requisition;

                if (requisition.status != RequisitionStatus.CANCELLED &&
                                requisition.status != RequisitionStatus.COMPLETED &&
                                requisition.status != RequisitionStatus.ISSUED) {

                        requisition.status = RequisitionStatus.SHORTAGE_PENDING;

                        requisition.setUpdatedBy(
                                        actor);

                        requisitionRepository.save(
                                        requisition);
                }
        }

        private void ensureShortageIndent(
                        MatFlowRequisitionLine line,
                        BigDecimal shortageAdded,
                        String actor) {

                if (line == null ||
                                line.requisition == null ||
                                line.material == null ||
                                line.requisition.destinationLocation == null) {

                        throw conflict(
                                        "Cannot create shortage indent from an incomplete requisition line");
                }

                MatFlowMaterialRequisition requisition = line.requisition;

                MatFlowIndent editableIndent = indentRepository
                                .findByRequisition_Id(
                                                requisition.getId())
                                .stream()
                                .filter(indent -> indent.status == IndentStatus.AUTO_CREATED ||
                                                indent.status == IndentStatus.DRAFT ||
                                                indent.status == IndentStatus.RETURNED)
                                .filter(indent -> indent.deliverToLocation != null &&
                                                indent.deliverToLocation
                                                                .getId()
                                                                .equals(
                                                                                requisition.destinationLocation
                                                                                                .getId()))
                                .findFirst()
                                .orElse(null);

                if (editableIndent == null) {
                        editableIndent = new MatFlowIndent();

                        editableIndent.indentNumber = "MFI-" +
                                        java.time.LocalDate.now()
                                                        .getYear()
                                        +
                                        "-" +
                                        UUID.randomUUID()
                                                        .toString()
                                                        .replace("-", "")
                                                        .substring(0, 8)
                                                        .toUpperCase();

                        editableIndent.requisition = requisition;

                        editableIndent.projectDrawing = requisition.projectDrawing;

                        editableIndent.bom = requisition.bom;

                        editableIndent.deliverToLocation = requisition.destinationLocation;

                        editableIndent.status = IndentStatus.AUTO_CREATED;

                        editableIndent.autoGenerated = true;

                        editableIndent.remarks = "Created after reservation release";

                        editableIndent.setCreatedBy(
                                        actor);

                        editableIndent.setUpdatedBy(
                                        actor);

                        editableIndent = indentRepository.save(
                                        editableIndent);
                }

                MatFlowIndent finalIndent = editableIndent;

                MatFlowIndentLine indentLine = indentLineRepository
                                .findByIndent_IdOrderByCreatedAtAsc(
                                                finalIndent.getId())
                                .stream()
                                .filter(existing -> existing.requisitionLine != null &&
                                                existing.requisitionLine
                                                                .getId()
                                                                .equals(
                                                                                line.getId()))
                                .findFirst()
                                .orElse(null);

                if (indentLine == null) {
                        indentLine = new MatFlowIndentLine();

                        indentLine.indent = finalIndent;

                        indentLine.requisitionLine = line;

                        indentLine.material = line.material;

                        indentLine.requiredQty = scale(
                                        shortageAdded);

                        indentLine.orderedQty = BigDecimal.ZERO;

                        indentLine.receivedQty = BigDecimal.ZERO;

                        indentLine.uom = line.material.getUom();                

                        indentLine.remarks = "Shortage created after reservation release";

                        indentLine.setCreatedBy(
                                        actor);

                } else {
                        indentLine.requiredQty = scale(
                                        scale(
                                                        indentLine.requiredQty)
                                                        .add(
                                                                        shortageAdded));
                }

                indentLine.setUpdatedBy(
                                actor);

                indentLineRepository.save(
                                indentLine);
        }

        private void ensureNoPhysicalExecution(
                        MatFlowMaterialRequisition requisition) {

                List<MatFlowRequisitionLine> requisitionLines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId());

                boolean materialIssued = requisitionLines.stream()
                                .anyMatch(line -> scale(
                                                line.issuedQty)
                                                .compareTo(
                                                                BigDecimal.ZERO) > 0);

                if (materialIssued) {
                        throw conflict(
                                        "Requisition cannot be cancelled after material has been issued to Production");
                }
                List<MatFlowTransferOrder> transfers = transferRepository
                                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                                requisition.getId());

                boolean transferStarted = transfers.stream()
                                .anyMatch(transfer -> transfer.status != TransferStatus.PLANNED &&
                                                transfer.status != TransferStatus.READY &&
                                                transfer.status != TransferStatus.CANCELLED);

                if (transferStarted) {
                        throw conflict(
                                        "Requisition cannot be cancelled after a transfer has started");
                }

                List<MatFlowIndent> indents = indentRepository
                                .findByRequisition_Id(
                                                requisition.getId());

                for (MatFlowIndent indent : indents) {
                        List<MatFlowPurchaseOrder> orders = purchaseOrderRepository
                                        .findByIndent_Id(
                                                        indent.getId());

                        boolean committedPurchase = orders.stream()
                                        .anyMatch(order -> order.status != PurchaseOrderStatus.DRAFT &&
                                                        order.status != PurchaseOrderStatus.CANCELLED);

                        if (committedPurchase) {
                                throw conflict(
                                                "Requisition cannot be cancelled after a purchase order has been placed");
                        }
                }
        }

        private MatFlowReservation requireReservation(
                        UUID id) {

                MatFlowReservation reservation = reservationRepository
                                .lockById(id)
                                .orElseThrow(() -> notFound(
                                                "Reservation not found"));

                accessService.requirePlantAccess(
                                reservation.sourceLocation
                                                .getPlantCode());

                return reservation;
        }

        private ReservationResponse toReservationResponse(
                        MatFlowReservation reservation) {

                if (reservation == null ||
                                reservation.requisitionLine == null ||
                                reservation.requisitionLine.requisition == null ||
                                reservation.material == null ||
                                reservation.sourceLocation == null ||
                                reservation.firstDestinationLocation == null ||
                                reservation.requisitionLine.requisition.destinationLocation == null) {

                        throw conflict(
                                        "Reservation record is incomplete");
                }

                BigDecimal reservedQty = scale(
                                reservation.reservedQty);

                BigDecimal issuedQty = scale(
                                reservation.issuedQty);

                BigDecimal remainingIssueQty = reservedQty
                                .subtract(
                                                issuedQty)
                                .max(
                                                BigDecimal.ZERO)
                                .setScale(
                                                3,
                                                RoundingMode.HALF_UP);

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

                                reservedQty,

                                reservation.status,

                                reservation.getRowVersion(),

                                issuedQty,

                                remainingIssueQty,

                                false,

                                reservation.requisitionLine.requisition.destinationLocation
                                                .getId(),

                                reservation.requisitionLine.requisition.destinationLocation
                                                .getLocationCode(),

                                "NONE",

                                reservation.status == ReservationStatus.RELEASED
                                                ? "RELEASED"
                                                : "NOT_ISSUE_READY");
        }

        private void saveReleaseLedger(
                        MatFlowStockBalance balance,
                        MatFlowReservation reservation,
                        BigDecimal releasedQty,
                        String reason,
                        String actor) {
                MatFlowStockLedger ledger = new MatFlowStockLedger();

                ledger.material = balance.material;

                ledger.location = balance.location;

                ledger.movementType = MovementType.RELEASE_RESERVATION;

                ledger.quantityChange = BigDecimal.ZERO;

                ledger.reservedChange = releasedQty.negate();

                ledger.blockedChange = BigDecimal.ZERO;

                ledger.inTransitChange = BigDecimal.ZERO;

                ledger.onHandAfter = balance.onHandQty;

                ledger.reservedAfter = balance.reservedQty;

                ledger.blockedAfter = balance.blockedQty;

                ledger.inTransitAfter = balance.inTransitQty;

                ledger.referenceType = "MATFLOW_RESERVATION";

                ledger.referenceId = reservation.getId();

                ledger.referenceNumber = reservation.requisitionLine.requisition.requisitionNumber;

                ledger.remarks = clean(reason);

                ledger.actor = actor;

                ledgerRepository.save(ledger);
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

        private BigDecimal scale(
                        BigDecimal value) {
                return value == null
                                ? BigDecimal.ZERO
                                : value.setScale(
                                                3,
                                                RoundingMode.HALF_UP);
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