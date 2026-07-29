package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
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
            MatFlowAccessService accessService) {
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
    }

    @Transactional
    public ReservationResponse releaseReservation(
            UUID reservationId,
            ReservationReleaseRequest request) {
        accessService.requireReservationRelease();

        MatFlowReservation reservation = requireReservation(
                reservationId);

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
                requisition.destinationLocation.plantCode);

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

        if (balance.reservedQty
                .compareTo(
                        reservation.reservedQty) < 0) {
            throw conflict(
                    "Stock reservation balance is inconsistent");
        }

        balance.reservedQty = scale(
                balance.reservedQty
                        .subtract(
                                reservation.reservedQty));

        balance.setUpdatedBy(actor);

        balance = stockRepository.save(balance);

        MatFlowRequisitionLine requisitionLine = reservation.requisitionLine;

        requisitionLine.reservedQty = scale(
                requisitionLine.reservedQty
                        .subtract(
                                reservation.reservedQty)
                        .max(BigDecimal.ZERO));

        requisitionLine.shortageQty = scale(
                requisitionLine.shortageQty
                        .add(
                                reservation.reservedQty));

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
                reason,
                actor);
    }

    private void ensureNoPhysicalExecution(
            MatFlowMaterialRequisition requisition) {
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
                .findById(id)
                .orElseThrow(() -> notFound(
                        "Reservation not found"));

        accessService.requirePlantAccess(
                reservation.sourceLocation.plantCode);

        return reservation;
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
                reservation.sourceLocation.locationCode,
                reservation.sourceLocation.plantCode,

                reservation.firstDestinationLocation
                        .getId(),
                reservation.firstDestinationLocation.locationCode,

                reservation.demandPlantCode,
                reservation.reservedQty,
                reservation.status,
                reservation.getRowVersion());
    }

    private void saveReleaseLedger(
            MatFlowStockBalance balance,
            MatFlowReservation reservation,
            String reason,
            String actor) {
        MatFlowStockLedger ledger = new MatFlowStockLedger();

        ledger.material = balance.material;

        ledger.location = balance.location;

        ledger.movementType = MovementType.RELEASE_RESERVATION;

        ledger.quantityChange = BigDecimal.ZERO;

        ledger.reservedChange = reservation.reservedQty
                .negate();

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