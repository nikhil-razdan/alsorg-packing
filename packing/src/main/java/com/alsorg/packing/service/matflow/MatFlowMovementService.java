package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProductionReceiveRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReceiveRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferResponse;

import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.*;
import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Internal custody engine + Production material returns.
 *
 * mf_transfer_orders remain durable audit/custody records, but they are no
 * longer a user-facing desk. Store and Processing advance physical material
 * through internal custody records; QC is only a non-location check gate.
 * Production explicitly acknowledges its final receipt.
 */
@Service
public class MatFlowMovementService {

        private static final Logger LOG = LoggerFactory.getLogger(MatFlowMovementService.class);

        private final TransferModule transfers;
        private final ReturnModule returns;
        private final MatFlowAccessService accessService;
        private final MatFlowPlantRoutingService plantRoutingService;

        public MatFlowMovementService(
                        MatFlowTransferOrderRepository transferRepository,
                        MatFlowTransferLineRepository transferLineRepository,
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowReservationRepository reservationRepository,
                        MatFlowRequisitionLineRepository requisitionLineRepository,
                        MatFlowQcInspectionRepository qcRepository,
                        MatFlowMaterialReturnRepository returnRepository,
                        MatFlowMaterialReturnLineRepository returnLineRepository,
                        MatFlowMaterialRequisitionRepository requisitionRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService,
                        MatFlowRequisitionService requisitionService,
                        MatFlowPlantRoutingService plantRoutingService) {

                this.accessService = accessService;
                this.plantRoutingService = plantRoutingService;

                this.transfers = new TransferModule(
                                transferRepository,
                                transferLineRepository,
                                stockRepository,
                                ledgerRepository,
                                reservationRepository,
                                requisitionLineRepository,
                                requisitionRepository,
                                accessService,
                                qcRepository,
                                auditService,
                                requisitionService,
                                plantRoutingService);

                this.returns = new ReturnModule(
                                returnRepository,
                                returnLineRepository,
                                requisitionRepository,
                                requisitionLineRepository,
                                locationRepository,
                                stockRepository,
                                ledgerRepository,
                                accessService,
                                auditService,
                                plantRoutingService,
                                requisitionService);
        }

        /**
         * Store's explicit Issue/Send action. The Store user can release all or part
         * of one reservation lot. The selected quantity is physically advanced to
         * the destination already captured during Store review (Processing or
         * Production).
         * A QC-required lot remains deferred until its QC tick is complete.
         */
        @Transactional
        public PlanningResponse advanceStoreReservation(UUID reservationId, StoreIssueRequest request) {
                accessService.requireMaterialPlanning();
                MatFlowReservation reservation = transfers.requireReservationForSnapshot(reservationId);
                if (request == null || request.rowVersion() == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Reservation rowVersion is required");
                }
                if (!request.rowVersion().equals(reservation.getRowVersion())) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Reservation was modified by another user. Refresh and retry.");
                }
                BigDecimal remainingLot = zero(reservation.reservedQty)
                                .subtract(zero(reservation.issuedQty))
                                .max(BigDecimal.ZERO)
                                .setScale(3, RoundingMode.HALF_UP);
                if (remainingLot.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Reservation lot is already fully issued");
                }
                if (request.quantity() != null &&
                                request.quantity().setScale(3, RoundingMode.HALF_UP).compareTo(remainingLot) != 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Issue/Send must move the complete reservation lot of " + remainingLot
                                                        + ". Split the Store allocation into separate reservation lots when different routes or quantities are needed.");
                }
                transfers.advanceStoreOrRoutingReservation(
                                reservationId,
                                remainingLot,
                                request.batchNo(),
                                request.remarks());
                return planningSnapshot(reservationId);
        }

        /**
         * Internal full-lot advancement used after a QC route decision or Processing
         * completion. The caller service has already enforced the owning desk role.
         */
        /**
         * Returns the Store-selected Processing BOM step for this reservation, if
         * Processing is part of its saved route. Used only to queue the Processing
         * job after Store has physically sent the lot to the processor.
         */
        @Transactional(readOnly = true)
        public UUID processingRouteStepId(UUID reservationId) {
                return transfers.processingRouteStepId(reservationId);
        }

        @Transactional
        public PlanningResponse advanceReservation(UUID reservationId, String remarks) {
                transfers.advanceStoreOrRoutingReservation(reservationId, null, null, remarks);
                return planningSnapshot(reservationId);
        }

        /** Origin Plant Store explicitly receives the inter-plant lot from AL-P1. */
        @Transactional
        public PlanningResponse receiveStoreReservation(
                        UUID reservationId,
                        StoreReceiveRequest request) {
                transfers.receiveOriginStoreReservation(reservationId, request);
                return planningSnapshot(reservationId);
        }

        /** Processing completion sends output back to AL-P1 Main Store. */
        @Transactional
        public PlanningResponse advanceReservationAfterProcessing(
                        UUID reservationId,
                        String remarks) {
                transfers.advanceAfterProcessing(reservationId, remarks);
                return planningSnapshot(reservationId);
        }

        @Transactional
        public PlanningResponse receiveProductionReservation(
                        UUID reservationId,
                        ProductionReceiveRequest request) {
                accessService.requireProductionRequest();
                transfers.receiveProductionReservation(reservationId, request);
                return planningSnapshot(reservationId);
        }

        private PlanningResponse planningSnapshot(UUID reservationId) {
                MatFlowReservation reservation = transfers.requireReservationForSnapshot(reservationId);
                if (reservation.requisitionLine == null || reservation.requisitionLine.requisition == null) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Reservation is not linked to a valid Material Requisition");
                }
                return transfers.requisitionService.getPlanningSnapshot(
                                reservation.requisitionLine.requisition.getId());
        }

        private BigDecimal zero(BigDecimal value) {
                return value == null
                                ? BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP)
                                : value.setScale(3, RoundingMode.HALF_UP);
        }

        @Transactional(readOnly = true)
        public List<MaterialReturnResponse> listReturns() {
                return returns.list();
        }

        @Transactional
        public MaterialReturnResponse createReturn(MaterialReturnCreateRequest request) {
                return returns.create(request);
        }

        @Transactional
        public MaterialReturnResponse dispatchReturn(UUID id, MaterialReturnActionRequest request) {
                return returns.dispatch(id, request);
        }

        @Transactional
        public MaterialReturnResponse receiveReturn(UUID id, MaterialReturnActionRequest request) {
                return returns.receive(id, request);
        }

        private static final class TransferModule {

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
                private final MatFlowRequisitionService requisitionService;
                private final MatFlowPlantRoutingService plantRoutingService;

                TransferModule(
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowTransferLineRepository transferLineRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowMaterialRequisitionRepository requisitionRepository,
                                MatFlowAccessService accessService,
                                MatFlowQcInspectionRepository qcRepository,
                                MatFlowAuditService auditService,
                                MatFlowRequisitionService requisitionService,
                                MatFlowPlantRoutingService plantRoutingService) {

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
                        this.requisitionService = requisitionService;
                        this.plantRoutingService = plantRoutingService;
                }

                UUID processingRouteStepId(UUID reservationId) {
                        if (reservationId == null) {
                                return null;
                        }
                        return transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservationId)
                                        .stream()
                                        .filter(transfer -> transfer != null
                                                        && transfer.toLocation != null
                                                        && (transfer.toLocation
                                                                        .getLocationType() == LocationType.PROCESSING
                                                                        || transfer.toLocation
                                                                                        .getLocationType() == LocationType.EXTERNAL_PROCESSOR))
                                        .map(transfer -> transferLineRepository
                                                        .findFirstByTransferOrder_IdOrderByCreatedAtAsc(
                                                                        transfer.getId())
                                                        .map(line -> line.routeStepId)
                                                        .orElse(null))
                                        .filter(java.util.Objects::nonNull)
                                        .findFirst()
                                        .orElse(null);
                }

                void advanceStoreOrRoutingReservation(
                                UUID reservationId,
                                BigDecimal requestedQuantity,
                                String batchNo,
                                String remarks) {
                        MatFlowReservation reservation = requireReservationForSnapshot(reservationId);

                        List<MatFlowTransferOrder> route = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservationId);
                        MatFlowTransferOrder next = route.stream()
                                        .filter(item -> item != null
                                                        && item.status != TransferStatus.RECEIVED
                                                        && item.status != TransferStatus.CANCELLED)
                                        .findFirst()
                                        .orElseThrow(() -> conflict(
                                                        "No pending internal hand-off exists for this reserved material"));

                        if (next.fromLocation == null) {
                                throw conflict("Next material hand-off has no source location");
                        }
                        LocationType sourceType = next.fromLocation.getLocationType();
                        if (sourceType != LocationType.STORE) {
                                throw conflict("This hand-off is owned by " + sourceType
                                                + ", not by a Store issue action");
                        }
                        accessService.requireTransferDispatch(next.fromLocation);

                        if (next.status == TransferStatus.PLANNED) {
                                throw conflict("The next material hand-off is waiting for QC, Processing or prior Store receipt");
                        }

                        MatFlowTransferLine line = requireLockedTransferLine(next.getId());
                        BigDecimal remaining = zero(line.plannedQty).subtract(zero(line.receivedQty))
                                        .max(ZERO).setScale(3, RoundingMode.HALF_UP);
                        if (remaining.compareTo(ZERO) <= 0) {
                                throw conflict("The selected material hand-off is already complete");
                        }

                        BigDecimal quantity = requestedQuantity == null
                                        ? remaining
                                        : positiveQuantity(requestedQuantity, remaining, "Issue/send quantity");

                        BigDecimal alreadyInTransit = zero(line.dispatchedQty).subtract(zero(line.receivedQty))
                                        .max(ZERO).setScale(3, RoundingMode.HALF_UP);
                        BigDecimal dispatchNeeded = quantity.subtract(alreadyInTransit)
                                        .max(ZERO).setScale(3, RoundingMode.HALF_UP);
                        if (dispatchNeeded.compareTo(ZERO) > 0) {
                                dispatch(next.getId(), new TransferActionRequest(
                                                next.getRowVersion(), dispatchNeeded, batchNo, remarks));
                        }

                        MatFlowTransferOrder afterDispatch = requireLockedTransfer(next.getId());
                        if (afterDispatch.toLocation == null) {
                                throw conflict("Material hand-off has no destination location");
                        }
                        LocationType destinationType = afterDispatch.toLocation.getLocationType();

                        /*
                         * Production and remote Plant Stores acknowledge receipt explicitly.
                         * A Processing destination is received atomically so its auto-created
                         * job can begin without exposing a Transfers desk.
                         */
                        if (destinationType == LocationType.PRODUCTION
                                        || destinationType == LocationType.STORE) {
                                return;
                        }

                        if (destinationType != LocationType.PROCESSING
                                        && destinationType != LocationType.EXTERNAL_PROCESSOR) {
                                throw conflict("Unsupported Store issue destination: " + destinationType);
                        }

                        receiveOutstandingInternally(afterDispatch, quantity, batchNo, remarks);
                }

                void receiveOriginStoreReservation(
                                UUID reservationId,
                                StoreReceiveRequest request) {
                        MatFlowReservation reservation = requireReservationForSnapshot(reservationId);
                        String originPlant = plantRoutingService.normalizeFactoryPlant(reservation.demandPlantCode);
                        if (!plantRoutingService.requiresOriginStoreHop(originPlant)) {
                                throw conflict("AL-P1 material is issued directly to Production and has no origin-Store receipt hop");
                        }
                        plantRoutingService.requireOriginStoreActor(originPlant);
                        if (request == null || request.rowVersion() == null) {
                                throw badRequest("Reservation rowVersion is required");
                        }
                        if (!request.rowVersion().equals(reservation.getRowVersion())) {
                                throw conflict("Reservation was modified by another user. Refresh and retry.");
                        }

                        MatFlowLocation originStore = plantRoutingService.requireOriginStore(originPlant);
                        MatFlowTransferOrder inbound = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservationId)
                                        .stream()
                                        .filter(transfer -> transfer != null && transfer.toLocation != null)
                                        .filter(transfer -> originStore.getId().equals(transfer.toLocation.getId()))
                                        .filter(transfer -> transfer.status != TransferStatus.RECEIVED
                                                        && transfer.status != TransferStatus.CANCELLED)
                                        .findFirst()
                                        .orElseThrow(() -> conflict(
                                                        "No Main Store material is waiting at the origin Plant Store"));

                        if (inbound.status == TransferStatus.PLANNED
                                        || inbound.status == TransferStatus.READY) {
                                throw conflict("AL-P1 Main Store has not dispatched this lot to the origin Plant Store yet");
                        }

                        MatFlowTransferLine line = requireLockedTransferLine(inbound.getId());
                        BigDecimal outstanding = zero(line.dispatchedQty).subtract(zero(line.receivedQty))
                                        .max(ZERO).setScale(3, RoundingMode.HALF_UP);
                        if (outstanding.compareTo(ZERO) <= 0) {
                                throw conflict("Origin Plant Store receipt is already complete");
                        }
                        receive(inbound.getId(), new TransferActionRequest(
                                        inbound.getRowVersion(), outstanding,
                                        request.batchNo(), request.remarks()));
                }

                void advanceAfterProcessing(UUID reservationId, String remarks) {
                        MatFlowReservation reservation = requireReservationForSnapshot(reservationId);
                        List<MatFlowTransferOrder> route = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservationId);
                        MatFlowTransferOrder next = route.stream()
                                        .filter(item -> item != null
                                                        && item.status != TransferStatus.RECEIVED
                                                        && item.status != TransferStatus.CANCELLED)
                                        .findFirst()
                                        .orElseThrow(() -> conflict("No pending post-Processing hand-off exists"));

                        if (next.fromLocation == null
                                        || (next.fromLocation.getLocationType() != LocationType.PROCESSING
                                                        && next.fromLocation.getLocationType() != LocationType.EXTERNAL_PROCESSOR)) {
                                throw conflict("The next hand-off is not owned by Processing");
                        }
                        accessService.requireTransferDispatch(next.fromLocation);

                        String actor = accessService.actor();
                        if (next.status == TransferStatus.PLANNED) {
                                next.status = TransferStatus.READY;
                                next.setUpdatedBy(actor);
                                next = transferRepository.saveAndFlush(next);
                                auditService.record(
                                                "TRANSFER", next.getId(), "TRANSFER_READY_AFTER_PROCESSING",
                                                next.fromLocation.getPlantCode(),
                                                reservation.requisitionLine == null
                                                                || reservation.requisitionLine.requisition == null
                                                                || reservation.requisitionLine.requisition.projectDrawing == null
                                                                                ? null
                                                                                : reservation.requisitionLine.requisition.projectDrawing.getProjectCode(),
                                                reservation.requisitionLine == null
                                                                || reservation.requisitionLine.requisition == null
                                                                || reservation.requisitionLine.requisition.projectDrawing == null
                                                                                ? null
                                                                                : reservation.requisitionLine.requisition.projectDrawing.getDrawingNo(),
                                                auditService.details("reservationId", reservationId));
                        }

                        MatFlowTransferLine line = requireLockedTransferLine(next.getId());
                        BigDecimal remaining = zero(line.plannedQty).subtract(zero(line.receivedQty))
                                        .max(ZERO).setScale(3, RoundingMode.HALF_UP);
                        if (remaining.compareTo(ZERO) <= 0) {
                                return;
                        }
                        BigDecimal inTransit = zero(line.dispatchedQty).subtract(zero(line.receivedQty))
                                        .max(ZERO).setScale(3, RoundingMode.HALF_UP);
                        BigDecimal dispatchNeeded = remaining.subtract(inTransit).max(ZERO)
                                        .setScale(3, RoundingMode.HALF_UP);
                        if (dispatchNeeded.compareTo(ZERO) > 0) {
                                dispatch(next.getId(), new TransferActionRequest(
                                                next.getRowVersion(), dispatchNeeded, null, remarks));
                        }
                        MatFlowTransferOrder afterDispatch = requireLockedTransfer(next.getId());
                        if (afterDispatch.toLocation == null
                                        || !plantRoutingService.isMainStoreLocation(afterDispatch.toLocation)) {
                                throw conflict("Processing output must return to AL-P1 Main Store before plant issue");
                        }
                        receiveOutstandingInternally(afterDispatch, remaining, null, remarks);
                }

                private void receiveOutstandingInternally(
                                MatFlowTransferOrder transfer,
                                BigDecimal requestedQty,
                                String batchNo,
                                String remarks) {
                        MatFlowTransferOrder locked = requireLockedTransfer(transfer.getId());
                        MatFlowTransferLine line = requireLockedTransferLine(locked.getId());
                        BigDecimal outstanding = zero(line.dispatchedQty).subtract(zero(line.receivedQty))
                                        .max(ZERO).setScale(3, RoundingMode.HALF_UP);
                        BigDecimal qty = requestedQty == null ? outstanding : requestedQty.min(outstanding);
                        if (qty.compareTo(ZERO) > 0) {
                                receiveInternal(locked.getId(), new TransferActionRequest(
                                                locked.getRowVersion(), qty, batchNo, remarks), false);
                        }
                }

                void receiveProductionReservation(
                                UUID reservationId,
                                ProductionReceiveRequest request) {
                        MatFlowReservation reservation = requireReservationForSnapshot(reservationId);
                        if (reservation.requisitionLine == null || reservation.requisitionLine.requisition == null) {
                                throw conflict("Reservation is not linked to a valid Material Requisition");
                        }
                        accessService.requireProductionOwnership(
                                        reservation.requisitionLine.requisition.requestedBy);
                        accessService.requirePlantAccess(reservation.demandPlantCode);

                        if (request == null || request.rowVersion() == null) {
                                throw badRequest("Reservation rowVersion is required");
                        }
                        if (!request.rowVersion().equals(reservation.getRowVersion())) {
                                throw conflict("Reservation was modified by another user. Refresh and retry.");
                        }

                        MatFlowTransferOrder productionTransfer = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservationId)
                                        .stream()
                                        .filter(transfer -> transfer != null && transfer.toLocation != null)
                                        .filter(transfer -> transfer.toLocation
                                                        .getLocationType() == LocationType.PRODUCTION)
                                        .filter(transfer -> transfer.status != TransferStatus.RECEIVED
                                                        && transfer.status != TransferStatus.CANCELLED)
                                        .findFirst()
                                        .orElseThrow(() -> conflict(
                                                        "No material is waiting for Production receipt for this reservation"));

                        if (productionTransfer.status == TransferStatus.PLANNED
                                        || productionTransfer.status == TransferStatus.READY) {
                                throw conflict("Material has not yet been sent to Production");
                        }

                        MatFlowTransferLine line = requireLockedTransferLine(productionTransfer.getId());
                        BigDecimal outstanding = zero(line.dispatchedQty)
                                        .subtract(zero(line.receivedQty))
                                        .max(ZERO)
                                        .setScale(3, RoundingMode.HALF_UP);
                        if (outstanding.compareTo(ZERO) <= 0) {
                                throw conflict("Production material receipt is already complete");
                        }

                        MatFlowTransferOrder locked = requireLockedTransfer(productionTransfer.getId());
                        receive(locked.getId(), new TransferActionRequest(
                                        locked.getRowVersion(),
                                        outstanding,
                                        request.batchNo(),
                                        request.remarks()));
                }

                MatFlowReservation requireReservationForSnapshot(UUID reservationId) {
                        if (reservationId == null) {
                                throw badRequest("Reservation ID is required");
                        }
                        MatFlowReservation reservation = reservationRepository.findById(reservationId)
                                        .orElseThrow(() -> notFound("Reservation not found"));
                        reservation = (MatFlowReservation) Hibernate.unproxy(reservation);
                        if (reservation.requisitionLine != null) {
                                reservation.requisitionLine = (MatFlowRequisitionLine) Hibernate
                                                .unproxy(reservation.requisitionLine);
                                if (reservation.requisitionLine.requisition != null) {
                                        reservation.requisitionLine.requisition = (MatFlowMaterialRequisition) Hibernate
                                                        .unproxy(
                                                                        reservation.requisitionLine.requisition);
                                }
                        }
                        return reservation;
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
                                        .filter(transfer -> status == null ||
                                                        transfer.status == status)
                                        .map(transfer -> toVisibleListResponse(
                                                        transfer,
                                                        normalizedPlant))
                                        .filter(Objects::nonNull)
                                        .toList();
                }

                /**
                 * List views are operational queues. A single malformed historical row
                 * must not break internal custody/tracker reads. We therefore validate and
                 * convert each visible transfer independently. Explicit GET /transfers/{id}
                 * remains strict and still returns the integrity error for the bad row.
                 */
                private TransferResponse toVisibleListResponse(
                                MatFlowTransferOrder transfer,
                                String normalizedPlant) {

                        try {
                                if (transfer == null || transfer.getId() == null) {
                                        throw conflict(
                                                        "Transfer order is missing its identity");
                                }

                                if (transfer.fromLocation == null ||
                                                transfer.toLocation == null) {
                                        throw conflict(
                                                        "Transfer source or destination is missing");
                                }

                                String fromPlant = cleanUpper(
                                                transfer.fromLocation.getPlantCode());

                                String toPlant = cleanUpper(
                                                transfer.toLocation.getPlantCode());

                                boolean readable = (fromPlant != null &&
                                                accessService.canAccessPlant(fromPlant))
                                                ||
                                                (toPlant != null &&
                                                                accessService.canAccessPlant(toPlant));

                                if (!readable) {
                                        return null;
                                }

                                if (normalizedPlant != null &&
                                                !normalizedPlant.equals(fromPlant) &&
                                                !normalizedPlant.equals(toPlant)) {
                                        return null;
                                }

                                return toResponse(
                                                transfer);

                        } catch (ResponseStatusException integrityFailure) {
                                LOG.warn(
                                                "Skipping invalid MatFlow transfer {} ({}) from list response: {}",
                                                transfer == null ? null : transfer.getId(),
                                                transfer == null ? null : transfer.transferNumber,
                                                integrityFailure.getReason());

                                return null;
                        }
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

                        MatFlowMaterialRequisition transferRequisition = requireTransferRequisition(
                                        transfer);

                        validateTransferLocations(
                                        transfer);

                        accessService.requireTransferDispatch(transfer.fromLocation);

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

                        transfer = transferRepository.saveAndFlush(
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
                                        transferRequisition.projectDrawing
                                                        .getProjectCode(),
                                        transferRequisition.projectDrawing
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
                        return receiveInternal(id, request, true);
                }

                private TransferResponse receiveInternal(
                                UUID id,
                                TransferActionRequest request,
                                boolean enforceDestinationAccess) {

                        MatFlowTransferOrder transfer = requireLockedTransfer(id);

                        MatFlowMaterialRequisition transferRequisition = requireTransferRequisition(
                                        transfer);

                        validateTransferLocations(
                                        transfer);

                        if (enforceDestinationAccess) {
                                accessService.requireTransferReceive(transfer.toLocation);
                        }

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

                        boolean finalProductionDestination = !hasSuccessor &&
                                        transfer.toLocation
                                                        .getLocationType() == LocationType.PRODUCTION;

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
                                        dispositionTransfer ||
                                        finalProductionDestination) {

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

                        transfer = transferRepository.saveAndFlush(
                                        transfer);

                        /* Keep reservation custody aligned with the physically received leg. */
                        if (fullyReceived && transfer.reservation != null
                                        && transfer.reservation.getId() != null) {
                                MatFlowReservation custodyReservation = reservationRepository
                                                .findById(transfer.reservation.getId())
                                                .map(value -> (MatFlowReservation) Hibernate.unproxy(value))
                                                .orElseThrow(() -> conflict(
                                                                "Transfer reservation no longer exists"));
                                custodyReservation.sourceLocation = transfer.toLocation;
                                custodyReservation.material = transferLine.material;
                                custodyReservation.setUpdatedBy(actor);
                                reservationRepository.save(custodyReservation);
                        }

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

                        if (finalProductionDestination) {
                                recordProductionIssueOnReceipt(
                                                transfer, transferLine, destinationBalance, quantity,
                                                request == null ? null : request.batchNo(), actor);
                                requisitionService.refreshState(
                                                transferRequisition.getId(), actor);
                        }

                        /*
                         * Reaching Production is the issue event in the simplified MatFlow
                         * workflow. There is no second Transfer/Store confirmation page.
                         */
                        if (fullyReceived) {
                                if (hasSuccessor &&
                                                !processingDestination &&
                                                !qcDestination) {

                                        activateSuccessor(
                                                        transfer,
                                                        actor);
                                }

                                /*
                                 * Every completed hand-off can change the material-level
                                 * state (QC pending, Processing required, Ready to issue),
                                 * not only the final Production receipt.
                                 */
                                requisitionService.refreshState(
                                                transferRequisition.getId(),
                                                actor);
                        }

                        auditService.record(
                                        "TRANSFER",
                                        transfer.getId(),
                                        "TRANSFER_RECEIVED",
                                        transfer.toLocation
                                                        .getPlantCode(),
                                        transferRequisition.projectDrawing
                                                        .getProjectCode(),
                                        transferRequisition.projectDrawing
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

                private void recordProductionIssueOnReceipt(
                                MatFlowTransferOrder transfer,
                                MatFlowTransferLine transferLine,
                                MatFlowStockBalance productionBalance,
                                BigDecimal quantity,
                                String batchNo,
                                String actor) {
                        if (transfer.reservation == null || transfer.reservation.getId() == null) {
                                throw conflict("Final Production hand-off has no reservation lineage");
                        }
                        MatFlowReservation reservation = reservationRepository.findById(transfer.reservation.getId())
                                        .orElseThrow(() -> conflict("Final Production reservation was not found"));
                        reservation = (MatFlowReservation) Hibernate.unproxy(reservation);
                        if (reservation.requisitionLine == null) {
                                throw conflict("Final Production reservation has no MR line");
                        }
                        MatFlowRequisitionLine line = (MatFlowRequisitionLine) Hibernate
                                        .unproxy(reservation.requisitionLine);

                        BigDecimal nextReservationIssued = zero(reservation.issuedQty).add(quantity)
                                        .setScale(3, RoundingMode.HALF_UP);
                        if (nextReservationIssued.compareTo(zero(reservation.reservedQty)) > 0) {
                                throw conflict("Production receipt exceeds the reserved material quantity");
                        }
                        reservation.issuedQty = nextReservationIssued;
                        reservation.status = nextReservationIssued.compareTo(zero(reservation.reservedQty)) >= 0
                                        ? ReservationStatus.ISSUED
                                        : ReservationStatus.PARTIALLY_ISSUED;
                        reservation.setUpdatedBy(actor);
                        reservationRepository.save(reservation);

                        line.issuedMaterial = transferLine.material;
                        line.issuedQty = zero(line.issuedQty).add(quantity).setScale(3, RoundingMode.HALF_UP);
                        line.status = line.issuedQty.compareTo(zero(line.requestedQty)) >= 0
                                        ? RequisitionLineStatus.ISSUED_TO_PRODUCTION
                                        : RequisitionLineStatus.PARTIALLY_ISSUED;
                        line.setUpdatedBy(actor);
                        requisitionLineRepository.save(line);

                        // TRANSFER_IN initially parks the lot as reserved at Production;
                        // issuing it to the named Production demand releases that reservation
                        // without changing physical on-hand at the Production location.
                        BigDecimal currentReserved = zero(productionBalance.reservedQty);
                        if (currentReserved.compareTo(quantity) < 0) {
                                throw conflict("Production reserved stock is insufficient to complete issue");
                        }
                        productionBalance.reservedQty = currentReserved.subtract(quantity)
                                        .setScale(3, RoundingMode.HALF_UP);
                        productionBalance.setUpdatedBy(actor);
                        stockRepository.save(productionBalance);

                        saveTransferLedger(
                                        productionBalance, MovementType.ISSUE_TO_PRODUCTION,
                                        ZERO, quantity.negate(), ZERO, ZERO,
                                        transfer, batchNo,
                                        "Material received and issued to Production demand",
                                        actor);

                        MatFlowMaterialRequisition requisition = requireTransferRequisition(transfer);
                        auditService.record(
                                        "REQUISITION", requisition.getId(), "MATERIAL_ISSUED_TO_PRODUCTION",
                                        transfer.toLocation.getPlantCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "requisitionNumber", requisition.requisitionNumber,
                                                        "reservationId", reservation.getId(),
                                                        "materialCode",
                                                        transferLine.material == null ? null
                                                                        : transferLine.material.getMaterialCode(),
                                                        "quantity", quantity,
                                                        "productionLocation", transfer.toLocation.getLocationCode(),
                                                        "issuedTo", requisition.requestedBy));
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

                                                        MatFlowMaterialRequisition successorRequisition = requireTransferRequisition(
                                                                        successor);

                                                        auditService.record(
                                                                        "TRANSFER",
                                                                        successor.getId(),
                                                                        "TRANSFER_READY",
                                                                        successor.fromLocation
                                                                                        .getPlantCode(),
                                                                        successorRequisition.projectDrawing
                                                                                        .getProjectCode(),
                                                                        successorRequisition.projectDrawing
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

                /**
                 * Re-hydrates the requisition aggregate through the authoritative
                 * requisition repository before reading project/BOM fields.
                 *
                 * MatFlowTransferOrder.requisition is LAZY. Accessing public nested
                 * backing fields directly from a Hibernate proxy can make
                 * requisition.projectDrawing / requisition.bom appear null even when
                 * the foreign keys are valid. findDetailById() is already the
                 * established MatFlow requisition read contract and initializes the
                 * required aggregate safely.
                 */
                private MatFlowMaterialRequisition requireTransferRequisition(
                                MatFlowTransferOrder transfer) {

                        if (transfer == null ||
                                        transfer.requisition == null ||
                                        transfer.requisition.getId() == null) {

                                throw conflict(
                                                "Transfer requisition is missing");
                        }

                        UUID requisitionId = transfer.requisition.getId();

                        MatFlowMaterialRequisition loadedRequisition = requisitionRepository
                                        .findDetailById(requisitionId)
                                        .orElseThrow(() -> conflict(
                                                        "Transfer requisition no longer exists: " + requisitionId));

                        /*
                         * findDetailById(...) can resolve to the same managed Hibernate proxy
                         * already referenced by transfer.requisition. Direct reads of public
                         * backing fields on that proxy (requisitionNumber, projectDrawing, bom)
                         * bypass Hibernate's getter interception and can therefore look null.
                         * Always unwrap to the target entity before reading those fields.
                         */
                        MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(
                                        loadedRequisition);

                        if (requisition.projectDrawing == null) {
                                throw conflict(
                                                "Transfer requisition has no Project/Drawing master: " +
                                                                requisition.requisitionNumber);
                        }

                        if (requisition.bom == null) {
                                throw conflict(
                                                "Transfer requisition has no operational BOM: " +
                                                                requisition.requisitionNumber);
                        }

                        if (requisition.destinationLocation == null) {
                                throw conflict(
                                                "Transfer requisition has no Production destination: " +
                                                                requisition.requisitionNumber);
                        }

                        // Keep the transfer aggregate aligned with the hydrated instance.
                        transfer.requisition = requisition;

                        return requisition;
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

                        MatFlowMaterialRequisition transferRequisition = requireTransferRequisition(
                                        transfer);

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

                        ledger.projectCode = transferRequisition.projectDrawing
                                        .getProjectCode();

                        ledger.drawingNo = transferRequisition.projectDrawing
                                        .getDrawingNo();

                        ledger.batchNo = clean(
                                        batchNo);

                        ledger.remarks = clean(
                                        remarks);

                        ledger.actor = actor;

                        ledgerRepository.save(
                                        ledger);
                }

                private TransferResponse toResponse(
                                MatFlowTransferOrder transfer) {

                        if (transfer == null ||
                                        transfer.getId() == null) {

                                throw conflict(
                                                "Transfer order is required");
                        }

                        MatFlowMaterialRequisition requisition = requireTransferRequisition(
                                        transfer);

                        if (transfer.reservation == null) {
                                throw conflict(
                                                "Transfer reservation is missing");
                        }

                        MatFlowReservation reservation = (MatFlowReservation) Hibernate.unproxy(
                                        transfer.reservation);

                        transfer.reservation = reservation;

                        if (transfer.fromLocation == null ||
                                        transfer.toLocation == null) {

                                throw conflict(
                                                "Transfer source or destination is missing");
                        }

                        MatFlowTransferLine line = requireTransferLine(
                                        transfer.getId());

                        if (line.material == null) {
                                throw conflict(
                                                "Transfer material is missing");
                        }

                        line.material = (MatFlowMaterial) Hibernate.unproxy(
                                        line.material);

                        MatFlowProjectDrawing project = requisition.projectDrawing;

                        MatFlowBom bom = requisition.bom;

                        return new TransferResponse(

                                        transfer.getId(),
                                        transfer.transferNumber,

                                        requisition.getId(),
                                        requisition.requisitionNumber,

                                        project.getId(),
                                        project.getProjectCode(),
                                        project.getDrawingNo(),
                                        project.getProductName(),
                                        project.getClientName(),

                                        bom.getId(),
                                        bom.getBomNumber(),
                                        bom.getRevisionNo(),

                                        transfer.reservation
                                                        .getId(),

                                        transfer.reservation.requisitionLine == null
                                                        ? null
                                                        : transfer.reservation.requisitionLine
                                                                        .getId(),

                                        custodyLabel(transfer.fromLocation),
                                        transfer.fromLocation.getPlantCode(),
                                        custodyLabel(transfer.toLocation),
                                        transfer.toLocation.getPlantCode(),

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

                                        transferResponsibleDepartment(
                                                        transfer,
                                                        line),

                                        transferNextAction(
                                                        transfer,
                                                        line),

                                        transfer.getRowVersion());
                }

                private String custodyLabel(MatFlowLocation node) {
                        if (node == null || node.getLocationType() == null) {
                                return null;
                        }
                        return switch (node.getLocationType()) {
                                case STORE -> plantRoutingService.isMainStoreLocation(node)
                                                ? "AL-P1 MAIN STORE"
                                                : cleanUpper(node.getPlantCode()) + " STORE";
                                case PRODUCTION -> cleanUpper(node.getPlantCode()) + " PRODUCTION";
                                case PROCESSING, EXTERNAL_PROCESSOR ->
                                                clean(node.getLocationCode()) == null ? "PROCESSING UNIT" : node.getLocationCode();
                                case SUPPLIER -> "SUPPLIER";
                                case TRANSIT -> "IN TRANSIT";
                                case QC -> "QC CHECK";
                        };
                }

                private String reservationResponsibleDepartment(
                                MatFlowReservation reservation,
                                List<MatFlowTransferOrder> routeTransfers,
                                boolean issueReady) {

                        if (reservation == null ||
                                        reservation.status == null) {

                                return "UNKNOWN";
                        }

                        if (issueReady) {
                                return "STORE";
                        }

                        if (reservation.status == ReservationStatus.ISSUED) {

                                return "PRODUCTION";
                        }

                        if (reservation.status == ReservationStatus.RELEASED ||
                                        reservation.status == ReservationStatus.CANCELLED) {

                                return "NONE";
                        }

                        MatFlowTransferOrder currentTransfer = currentReservationTransfer(
                                        routeTransfers);

                        if (currentTransfer != null) {

                                MatFlowTransferLine line = requireTransferLine(
                                                currentTransfer.getId());

                                return transferResponsibleDepartment(
                                                currentTransfer,
                                                line);
                        }

                        if (routeTransfers != null &&
                                        !routeTransfers.isEmpty()) {

                                MatFlowTransferOrder finalTransfer = routeTransfers.get(
                                                routeTransfers.size() - 1);

                                return finalTransfer.toLocation == null
                                                ? "UNKNOWN"
                                                : departmentForLocation(
                                                                finalTransfer.toLocation);
                        }

                        return departmentForLocation(
                                        reservation.sourceLocation);
                }

                private String reservationNextAction(
                                MatFlowReservation reservation,
                                List<MatFlowTransferOrder> routeTransfers,
                                boolean issueReady) {

                        if (reservation == null ||
                                        reservation.status == null) {

                                return "UNKNOWN";
                        }

                        if (issueReady) {
                                return "ISSUE_TO_PRODUCTION";
                        }

                        if (reservation.status == ReservationStatus.ISSUED) {

                                return "MATERIAL_ISSUED_TO_PRODUCTION";
                        }

                        if (reservation.status == ReservationStatus.RELEASED) {

                                return "RESERVATION_RELEASED";
                        }

                        if (reservation.status == ReservationStatus.CANCELLED) {

                                return "RESERVATION_CANCELLED";
                        }

                        MatFlowTransferOrder currentTransfer = currentReservationTransfer(
                                        routeTransfers);

                        if (currentTransfer != null) {

                                MatFlowTransferLine line = requireTransferLine(
                                                currentTransfer.getId());

                                return transferNextAction(
                                                currentTransfer,
                                                line);
                        }

                        if (routeTransfers != null &&
                                        !routeTransfers.isEmpty()) {

                                MatFlowTransferOrder finalTransfer = routeTransfers.get(
                                                routeTransfers.size() - 1);

                                if (finalTransfer.toLocation != null) {

                                        LocationType destinationType = finalTransfer.toLocation
                                                        .getLocationType();

                                        if (destinationType == LocationType.QC) {

                                                return "INSPECT_MATERIAL";
                                        }

                                        if (destinationType == LocationType.PROCESSING ||
                                                        destinationType == LocationType.EXTERNAL_PROCESSOR) {

                                                return "COMPLETE_PROCESSING";
                                        }
                                }

                                return "COMPLETE_APPROVED_ROUTE";
                        }

                        return "AWAIT_MATERIAL_POSITION";
                }

                private MatFlowTransferOrder currentReservationTransfer(
                                List<MatFlowTransferOrder> transfers) {

                        if (transfers == null ||
                                        transfers.isEmpty()) {

                                return null;
                        }

                        return transfers.stream()
                                        .filter(
                                                        transfer -> transfer != null &&
                                                                        transfer.status != TransferStatus.RECEIVED &&
                                                                        transfer.status != TransferStatus.CANCELLED)
                                        .findFirst()
                                        .orElse(null);
                }

                private boolean isReservationIssueReady(
                                MatFlowReservation reservation,
                                MatFlowLocation issueLocation,
                                List<MatFlowTransferOrder> routeTransfers,
                                BigDecimal remainingIssueQty) {

                        if (reservation == null ||
                                        issueLocation == null ||
                                        reservation.sourceLocation == null ||
                                        reservation.status == null) {

                                return false;
                        }

                        if (remainingIssueQty == null ||
                                        remainingIssueQty.compareTo(
                                                        ZERO) <= 0) {

                                return false;
                        }

                        boolean activeReservation = reservation.status == ReservationStatus.ACTIVE ||
                                        reservation.status == ReservationStatus.PARTIALLY_ISSUED;

                        if (!activeReservation) {
                                return false;
                        }

                        /*
                         * No transfer means the reserved material was
                         * already at the final Production destination.
                         */
                        if (routeTransfers == null ||
                                        routeTransfers.isEmpty()) {

                                return reservation.sourceLocation
                                                .getId()
                                                .equals(
                                                                issueLocation.getId())
                                                &&
                                                reservation.sourceLocation
                                                                .getLocationType() == LocationType.PRODUCTION;
                        }

                        MatFlowTransferOrder finalTransfer = routeTransfers.get(
                                        routeTransfers.size() - 1);

                        if (finalTransfer == null ||
                                        finalTransfer.toLocation == null) {

                                return false;
                        }

                        return finalTransfer.status == TransferStatus.RECEIVED
                                        &&
                                        finalTransfer.toLocation
                                                        .getId()
                                                        .equals(
                                                                        issueLocation.getId())
                                        &&
                                        finalTransfer.toLocation
                                                        .getLocationType() == LocationType.PRODUCTION;
                }

                private String departmentForLocation(
                                MatFlowLocation location) {

                        if (location == null ||
                                        location.getLocationType() == null) {

                                return "UNKNOWN";
                        }

                        return switch (location.getLocationType()) {

                                case STORE ->
                                        "STORE";

                                case PRODUCTION ->
                                        "PRODUCTION";

                                case QC ->
                                        "QC";

                                case PROCESSING,
                                                EXTERNAL_PROCESSOR ->
                                        "PROCESSING";

                                default ->
                                        location.getLocationType()
                                                        .name();
                        };
                }

                private String transferResponsibleDepartment(
                                MatFlowTransferOrder transfer,
                                MatFlowTransferLine line) {

                        if (transfer == null ||
                                        transfer.status == null) {

                                return "UNKNOWN";
                        }

                        return switch (transfer.status) {

                                case PLANNED ->
                                        plannedResponsibleDepartment(
                                                        transfer);

                                case READY ->
                                        departmentForLocation(
                                                        transfer.fromLocation);

                                case PARTIALLY_DISPATCHED,
                                                PARTIALLY_RECEIVED -> {

                                        boolean dispatchRemaining = hasPendingDispatch(
                                                        line);

                                        boolean receiptPending = hasPendingReceipt(
                                                        line);

                                        if (dispatchRemaining &&
                                                        receiptPending) {

                                                yield departmentForLocation(
                                                                transfer.fromLocation)
                                                                +
                                                                " / " +
                                                                departmentForLocation(
                                                                                transfer.toLocation);
                                        }

                                        if (receiptPending) {
                                                yield departmentForLocation(
                                                                transfer.toLocation);
                                        }

                                        if (dispatchRemaining) {
                                                yield departmentForLocation(
                                                                transfer.fromLocation);
                                        }

                                        yield departmentForLocation(
                                                        transfer.toLocation);
                                }

                                case IN_TRANSIT ->
                                        departmentForLocation(
                                                        transfer.toLocation);

                                case RECEIVED -> {

                                        boolean hasSuccessor = transferRepository
                                                        .existsByPredecessorTransferId(
                                                                        transfer.getId());

                                        if (hasSuccessor) {

                                                /*
                                                 * The destination of this transfer becomes
                                                 * the source department of the next route step.
                                                 */
                                                yield departmentForLocation(
                                                                transfer.toLocation);
                                        }

                                        if (transfer.toLocation == null ||
                                                        transfer.toLocation
                                                                        .getLocationType() == null) {

                                                yield "UNKNOWN";
                                        }

                                        LocationType destinationType = transfer.toLocation
                                                        .getLocationType();

                                        if (destinationType == LocationType.PRODUCTION) {

                                                /*
                                                 * Transfer receipt is complete, but Store
                                                 * must still formally issue the reserved
                                                 * material to Production.
                                                 */
                                                yield "STORE";
                                        }

                                        yield departmentForLocation(
                                                        transfer.toLocation);
                                }

                                case CANCELLED ->
                                        "NONE";

                                default ->
                                        "UNKNOWN";
                        };
                }

                private String transferNextAction(
                                MatFlowTransferOrder transfer,
                                MatFlowTransferLine line) {

                        if (transfer == null ||
                                        transfer.status == null) {

                                return "UNKNOWN";
                        }

                        return switch (transfer.status) {

                                case PLANNED ->
                                        plannedNextAction(
                                                        transfer);

                                case READY ->
                                        "DISPATCH";

                                case PARTIALLY_DISPATCHED,
                                                PARTIALLY_RECEIVED -> {

                                        boolean dispatchRemaining = hasPendingDispatch(
                                                        line);

                                        boolean receiptPending = hasPendingReceipt(
                                                        line);

                                        if (dispatchRemaining &&
                                                        receiptPending) {

                                                yield "DISPATCH_REMAINDER_OR_RECEIVE_IN_TRANSIT";
                                        }

                                        if (receiptPending) {
                                                yield "RECEIVE";
                                        }

                                        if (dispatchRemaining) {
                                                yield "DISPATCH_REMAINDER";
                                        }

                                        yield "REFRESH_TRANSFER";
                                }

                                case IN_TRANSIT ->
                                        "RECEIVE";

                                case RECEIVED -> {

                                        if (transfer.toLocation == null ||
                                                        transfer.toLocation
                                                                        .getLocationType() == null) {

                                                yield "UNKNOWN";
                                        }

                                        LocationType destinationType = transfer.toLocation
                                                        .getLocationType();

                                        /*
                                         * A fully received QC/Processing leg still has a
                                         * department-owned gate before its successor may run.
                                         * Show that real gate instead of the generic
                                         * CONTINUE_APPROVED_ROUTE message.
                                         */
                                        if (destinationType == LocationType.QC) {
                                                yield "INSPECT_MATERIAL";
                                        }

                                        if (destinationType == LocationType.PROCESSING ||
                                                        destinationType == LocationType.EXTERNAL_PROCESSOR) {
                                                yield "COMPLETE_PROCESSING";
                                        }

                                        if (destinationType == LocationType.PRODUCTION) {
                                                yield "START_PRODUCTION";
                                        }

                                        boolean hasSuccessor = transferRepository
                                                        .existsByPredecessorTransferId(
                                                                        transfer.getId());

                                        if (hasSuccessor) {
                                                yield "CONTINUE_APPROVED_ROUTE";
                                        }

                                        yield "COMPLETED";
                                }

                                case CANCELLED ->
                                        "NONE";

                                default ->
                                        "UNKNOWN";
                        };
                }

                private MatFlowTransferOrder predecessorFor(
                                MatFlowTransferOrder transfer) {

                        if (transfer == null ||
                                        transfer.predecessorTransferId == null) {
                                return null;
                        }

                        return transferRepository
                                        .findById(transfer.predecessorTransferId)
                                        .map(value -> (MatFlowTransferOrder) Hibernate.unproxy(value))
                                        .orElse(null);
                }

                /**
                 * Human/desk ownership for a downstream PLANNED transfer.
                 *
                 * PLANNED does not always mean "the predecessor still needs receipt".
                 * A predecessor can already be RECEIVED at QC/Processing while the
                 * downstream transfer correctly waits for that department's decision.
                 */
                private String plannedResponsibleDepartment(
                                MatFlowTransferOrder transfer) {

                        MatFlowTransferOrder predecessor = predecessorFor(transfer);

                        if (predecessor == null) {
                                return departmentForLocation(
                                                transfer == null ? null : transfer.fromLocation);
                        }

                        if (predecessor.status != TransferStatus.RECEIVED) {
                                return departmentForLocation(
                                                predecessor.toLocation);
                        }

                        if (predecessor.toLocation == null ||
                                        predecessor.toLocation.getLocationType() == null) {
                                return departmentForLocation(
                                                transfer == null ? null : transfer.fromLocation);
                        }

                        LocationType gateType = predecessor.toLocation.getLocationType();

                        if (gateType == LocationType.QC) {
                                return "QC";
                        }

                        if (gateType == LocationType.PROCESSING ||
                                        gateType == LocationType.EXTERNAL_PROCESSOR) {
                                return "PROCESSING";
                        }

                        return departmentForLocation(
                                        transfer == null ? null : transfer.fromLocation);
                }

                private String plannedNextAction(
                                MatFlowTransferOrder transfer) {

                        MatFlowTransferOrder predecessor = predecessorFor(transfer);

                        if (predecessor == null) {
                                return "AWAIT_ROUTE_RELEASE";
                        }

                        if (predecessor.status != TransferStatus.RECEIVED) {
                                return "RECEIVE_PREVIOUS_ROUTE_TRANSFER";
                        }

                        if (predecessor.toLocation == null ||
                                        predecessor.toLocation.getLocationType() == null) {
                                return "AWAIT_ROUTE_RELEASE";
                        }

                        LocationType gateType = predecessor.toLocation.getLocationType();

                        if (gateType == LocationType.QC) {
                                return "INSPECT_MATERIAL";
                        }

                        if (gateType == LocationType.PROCESSING ||
                                        gateType == LocationType.EXTERNAL_PROCESSOR) {
                                return "COMPLETE_PROCESSING";
                        }

                        return "AWAIT_ROUTE_RELEASE";
                }

                private boolean hasPendingDispatch(
                                MatFlowTransferLine line) {

                        if (line == null) {
                                return false;
                        }

                        return zero(
                                        line.plannedQty)
                                        .subtract(
                                                        zero(
                                                                        line.dispatchedQty))
                                        .compareTo(
                                                        ZERO) > 0;
                }

                private boolean hasPendingReceipt(
                                MatFlowTransferLine line) {

                        if (line == null) {
                                return false;
                        }

                        return zero(
                                        line.dispatchedQty)
                                        .subtract(
                                                        zero(
                                                                        line.receivedQty))
                                        .compareTo(
                                                        ZERO) > 0;
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

                                /*
                                 * QC is not a numbered business document.
                                 * Keep the legacy NOT NULL / UNIQUE persistence column populated
                                 * with the already-unique source-line UUID only as a hidden technical
                                 * compatibility token. It is never exposed by the MatFlow QC API/UI.
                                 */
                                inspection.inspectionNumber = transferLine.getId().toString();

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

        private static final class ReturnModule {

                private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

                private final MatFlowMaterialReturnRepository returnRepository;
                private final MatFlowMaterialReturnLineRepository returnLineRepository;
                private final MatFlowMaterialRequisitionRepository requisitionRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowLocationRepository locationRepository;
                private final MatFlowStockBalanceRepository stockRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;
                private final MatFlowPlantRoutingService plantRoutingService;
                private final MatFlowRequisitionService requisitionService;

                ReturnModule(
                                MatFlowMaterialReturnRepository returnRepository,
                                MatFlowMaterialReturnLineRepository returnLineRepository,
                                MatFlowMaterialRequisitionRepository requisitionRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowLocationRepository locationRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService,
                                MatFlowPlantRoutingService plantRoutingService,
                                MatFlowRequisitionService requisitionService) {
                        this.returnRepository = returnRepository;
                        this.returnLineRepository = returnLineRepository;
                        this.requisitionRepository = requisitionRepository;
                        this.requisitionLineRepository = requisitionLineRepository;
                        this.locationRepository = locationRepository;
                        this.stockRepository = stockRepository;
                        this.ledgerRepository = ledgerRepository;
                        this.accessService = accessService;
                        this.auditService = auditService;
                        this.plantRoutingService = plantRoutingService;
                        this.requisitionService = requisitionService;
                }

                @Transactional(readOnly = true)
                public List<MaterialReturnResponse> list() {
                        accessService.requireRead();

                        return returnRepository.findAllByOrderByUpdatedAtDesc().stream()
                                        .map(this::hydrateReturn)
                                        .filter(this::canReadReturn)
                                        .map(this::toResponse)
                                        .toList();
                }

                @Transactional
                public MaterialReturnResponse create(MaterialReturnCreateRequest request) {
                        accessService.requireProductionReturnCreate();
                        validateCreateRequest(request);

                        MatFlowMaterialRequisition requisition = requisitionRepository
                                        .findDetailById(request.requisitionId())
                                        .map(value -> (MatFlowMaterialRequisition) Hibernate.unproxy(value))
                                        .orElseThrow(() -> notFound("Requisition not found"));
                        hydrateRequisitionAssociations(requisition);

                        accessService.requireProductionOwnership(requisition.requestedBy);
                        validateReturnRequisition(requisition);

                        MatFlowLocation fromLocation = requisition.destinationLocation;
                        if (fromLocation == null || fromLocation.getLocationType() != LocationType.PRODUCTION) {
                                throw conflict("MR Production routing context is missing");
                        }

                        String originPlant = plantRoutingService.normalizeFactoryPlant(
                                        requisition.destinationLocation.getPlantCode());
                        MatFlowLocation mainStore = requisition.mainStore == null
                                        ? plantRoutingService.requireMainStore()
                                        : hydrateLocation(requisition.mainStore);
                        plantRoutingService.assertMainStoreLocation(mainStore, "Material return destination");

                        MatFlowLocation viaStore = null;
                        if (plantRoutingService.requiresOriginStoreHop(originPlant)) {
                                viaStore = requisition.originStore == null
                                                ? plantRoutingService.requireOriginStore(originPlant)
                                                : hydrateLocation(requisition.originStore);
                                plantRoutingService.assertOriginStoreLocation(
                                                viaStore, originPlant, "Material return origin-Store route");
                        }

                        String actor = accessService.actor();
                        MatFlowMaterialReturn materialReturn = new MatFlowMaterialReturn();
                        materialReturn.returnNumber = generateNumber("MFRN");
                        materialReturn.requisition = requisition;
                        materialReturn.fromLocation = fromLocation;
                        materialReturn.viaLocation = viaStore;
                        materialReturn.toLocation = mainStore;
                        materialReturn.reason = request.reason();
                        materialReturn.status = MaterialReturnStatus.DRAFT;
                        materialReturn.createdForReturnBy = actor;
                        materialReturn.remarks = clean(request.remarks());
                        materialReturn.setCreatedBy(actor);
                        materialReturn.setUpdatedBy(actor);
                        materialReturn = returnRepository.saveAndFlush(materialReturn);

                        Set<UUID> uniqueLines = new HashSet<>();
                        for (MaterialReturnLineRequest lineRequest : request.lines()) {
                                if (lineRequest == null || lineRequest.requisitionLineId() == null) {
                                        throw badRequest("Every return line requires a requisition line");
                                }
                                if (!uniqueLines.add(lineRequest.requisitionLineId())) {
                                        throw badRequest("A requisition line was selected more than once");
                                }

                                /*
                                 * Serialize return creation per requisition line. Without this row
                                 * lock, two Production requests can both calculate the same
                                 * returnable quantity before either open return is visible.
                                 */
                                MatFlowRequisitionLine requisitionLine = requisitionLineRepository
                                                .lockById(lineRequest.requisitionLineId())
                                                .map(value -> (MatFlowRequisitionLine) Hibernate.unproxy(value))
                                                .orElseThrow(() -> notFound("Requisition line not found"));
                                if (requisitionLine.requisition == null
                                                || !requisition.getId().equals(requisitionLine.requisition.getId())) {
                                        throw badRequest("Return line does not belong to the selected requisition");
                                }

                                MatFlowMaterial material = requisitionLine.issuedMaterial != null
                                                ? (MatFlowMaterial) Hibernate.unproxy(requisitionLine.issuedMaterial)
                                                : requisitionLine.material == null
                                                                ? null
                                                                : (MatFlowMaterial) Hibernate.unproxy(requisitionLine.material);
                                if (material == null) {
                                        throw conflict("Requisition line has no issued/material master");
                                }

                                BigDecimal returnQty = positive(lineRequest.returnQty(), "Return quantity");
                                BigDecimal alreadyCommittedToOpenReturns = openCommittedReturnQtyForLine(
                                                requisitionLine.getId());
                                BigDecimal returnable = zero(requisitionLine.issuedQty)
                                                .subtract(zero(requisitionLine.consumedQty))
                                                .subtract(zero(requisitionLine.returnedQty))
                                                .subtract(productionWasteForLine(requisitionLine.getId()))
                                                .subtract(alreadyCommittedToOpenReturns)
                                                .max(ZERO)
                                                .setScale(3, RoundingMode.HALF_UP);
                                if (returnQty.compareTo(returnable) > 0) {
                                        throw conflict("Return quantity exceeds unused issued quantity for "
                                                        + material.getMaterialCode() + ". Returnable after open returns: "
                                                        + returnable);
                                }

                                MatFlowMaterialReturnLine line = new MatFlowMaterialReturnLine();
                                line.materialReturn = materialReturn;
                                line.requisitionLine = requisitionLine;
                                line.material = material;
                                line.returnQty = returnQty;
                                line.dispatchedQty = ZERO;
                                line.originStoreReceivedQty = ZERO;
                                line.forwardedQty = ZERO;
                                line.receivedQty = ZERO;
                                line.uom = material.getUom();
                                line.batchNo = clean(lineRequest.batchNo());
                                line.remarks = clean(lineRequest.remarks());
                                line.setCreatedBy(actor);
                                line.setUpdatedBy(actor);
                                returnLineRepository.save(line);
                        }

                        auditService.record(
                                        "MATERIAL_RETURN",
                                        materialReturn.getId(),
                                        "MATERIAL_RETURN_CREATED",
                                        originPlant,
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "returnNumber", materialReturn.returnNumber,
                                                        "reason", materialReturn.reason,
                                                        "originPlant", originPlant,
                                                        "viaStorePlant", viaStore == null ? null : viaStore.getPlantCode(),
                                                        "finalMainStorePlant", mainStore.getPlantCode(),
                                                        "lineCount", request.lines().size()));

                        return toResponse(materialReturn);
                }

                /**
                 * Context-aware dispatch:
                 * DRAFT -> Production dispatches first leg.
                 * AT_ORIGIN_STORE -> remote origin Store forwards second leg to AL-P1.
                 */
                @Transactional
                public MaterialReturnResponse dispatch(UUID id, MaterialReturnActionRequest request) {
                        MatFlowMaterialReturn materialReturn = requireReturn(id);
                        MatFlowMaterialRequisition requisition = requireReturnRequisition(materialReturn);
                        assertVersion(request == null ? null : request.rowVersion(),
                                        materialReturn.getRowVersion(), "Material return");

                        if (materialReturn.status == MaterialReturnStatus.DRAFT) {
                                return dispatchFromProduction(materialReturn, requisition, request);
                        }
                        if (materialReturn.status == MaterialReturnStatus.AT_ORIGIN_STORE) {
                                return forwardFromOriginStore(materialReturn, requisition, request);
                        }

                        throw conflict("Material return cannot be dispatched in status: " + materialReturn.status);
                }

                private MaterialReturnResponse dispatchFromProduction(
                                MatFlowMaterialReturn materialReturn,
                                MatFlowMaterialRequisition requisition,
                                MaterialReturnActionRequest request) {
                        accessService.requireProductionOwnership(requisition.requestedBy);
                        accessService.requireTransferDispatch(materialReturn.fromLocation);

                        String actor = accessService.actor();
                        List<MatFlowMaterialReturnLine> lines = requireReturnLines(materialReturn.getId());
                        for (MatFlowMaterialReturnLine line : lines) {
                                BigDecimal qty = zero(line.returnQty);
                                if (qty.compareTo(ZERO) <= 0) {
                                        throw conflict("Material return line has no quantity");
                                }
                                if (zero(line.dispatchedQty).compareTo(ZERO) > 0) {
                                        throw conflict("Material return has already been dispatched from Production");
                                }

                                MatFlowStockBalance source = stockRepository
                                                .lockBalance(line.material.getId(), materialReturn.fromLocation.getId())
                                                .orElseThrow(() -> conflict("Production stock balance not found for "
                                                                + line.material.getMaterialCode()));
                                BigDecimal usable = zero(source.onHandQty).subtract(zero(source.blockedQty)).max(ZERO);
                                if (usable.compareTo(qty) < 0) {
                                        throw conflict("Insufficient Production stock for return: "
                                                        + line.material.getMaterialCode());
                                }

                                source.onHandQty = zero(source.onHandQty).subtract(qty).setScale(3, RoundingMode.HALF_UP);
                                source.inTransitQty = zero(source.inTransitQty).add(qty).setScale(3, RoundingMode.HALF_UP);
                                source.setUpdatedBy(actor);
                                source = stockRepository.save(source);

                                line.dispatchedQty = qty;
                                line.setUpdatedBy(actor);
                                returnLineRepository.save(line);

                                saveLedger(source, MovementType.MATERIAL_RETURN_OUT,
                                                qty.negate(), ZERO, ZERO, qty,
                                                materialReturn, line,
                                                "Production material return dispatched", actor);
                        }

                        boolean remote = materialReturn.viaLocation != null;
                        materialReturn.status = remote
                                        ? MaterialReturnStatus.IN_TRANSIT_TO_ORIGIN_STORE
                                        : MaterialReturnStatus.IN_TRANSIT_TO_MAIN_STORE;
                        materialReturn.dispatchedBy = actor;
                        materialReturn.dispatchedAt = LocalDateTime.now();
                        applyRemarks(materialReturn, request == null ? null : request.remarks());
                        materialReturn.setUpdatedBy(actor);
                        materialReturn = returnRepository.saveAndFlush(materialReturn);

                        auditService.record(
                                        "MATERIAL_RETURN", materialReturn.getId(),
                                        remote ? "RETURN_DISPATCHED_TO_ORIGIN_STORE" : "RETURN_DISPATCHED_TO_MAIN_STORE",
                                        materialReturn.fromLocation.getPlantCode(),
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "returnNumber", materialReturn.returnNumber,
                                                        "from", materialReturn.fromLocation.getLocationCode(),
                                                        "to", remote
                                                                        ? materialReturn.viaLocation.getLocationCode()
                                                                        : materialReturn.toLocation.getLocationCode(),
                                                        "status", materialReturn.status));

                        return toResponse(materialReturn);
                }

                private MaterialReturnResponse forwardFromOriginStore(
                                MatFlowMaterialReturn materialReturn,
                                MatFlowMaterialRequisition requisition,
                                MaterialReturnActionRequest request) {
                        if (materialReturn.viaLocation == null) {
                                throw conflict("This return has no origin Plant Store forwarding leg");
                        }
                        String originPlant = plantRoutingService.normalizeFactoryPlant(
                                        materialReturn.viaLocation.getPlantCode());
                        plantRoutingService.requireOriginStoreActor(originPlant);
                        plantRoutingService.assertOriginStoreLocation(
                                        materialReturn.viaLocation, originPlant, "Material return forwarding");
                        plantRoutingService.assertMainStoreLocation(
                                        materialReturn.toLocation, "Material return final destination");

                        String actor = accessService.actor();
                        List<MatFlowMaterialReturnLine> lines = requireReturnLines(materialReturn.getId());
                        for (MatFlowMaterialReturnLine line : lines) {
                                BigDecimal availableToForward = zero(line.originStoreReceivedQty)
                                                .subtract(zero(line.forwardedQty))
                                                .max(ZERO)
                                                .setScale(3, RoundingMode.HALF_UP);
                                if (availableToForward.compareTo(ZERO) <= 0) {
                                        throw conflict("Origin Store has no unforwarded return quantity for "
                                                        + line.material.getMaterialCode());
                                }
                                if (availableToForward.compareTo(zero(line.returnQty)) != 0) {
                                        throw conflict("Origin Store must forward the complete received return lot for "
                                                        + line.material.getMaterialCode());
                                }

                                MatFlowStockBalance source = stockRepository
                                                .lockBalance(line.material.getId(), materialReturn.viaLocation.getId())
                                                .orElseThrow(() -> conflict("Origin Store return stock balance not found"));
                                if (zero(source.onHandQty).compareTo(availableToForward) < 0) {
                                        throw conflict("Origin Store stock is insufficient to forward the return lot");
                                }

                                source.onHandQty = zero(source.onHandQty).subtract(availableToForward)
                                                .setScale(3, RoundingMode.HALF_UP);
                                /*
                                 * Intermediate return stock is blocked while it waits in the
                                 * origin Store so no generic stock consumer can treat it as
                                 * reusable local inventory. Release that technical block when
                                 * the Store forwards the lot to Main Store.
                                 */
                                BigDecimal blockedReleased = zero(source.blockedQty)
                                                .min(availableToForward)
                                                .setScale(3, RoundingMode.HALF_UP);
                                source.blockedQty = zero(source.blockedQty).subtract(blockedReleased)
                                                .max(ZERO)
                                                .setScale(3, RoundingMode.HALF_UP);
                                source.inTransitQty = zero(source.inTransitQty).add(availableToForward)
                                                .setScale(3, RoundingMode.HALF_UP);
                                source.setUpdatedBy(actor);
                                source = stockRepository.save(source);

                                line.forwardedQty = zero(line.forwardedQty).add(availableToForward)
                                                .setScale(3, RoundingMode.HALF_UP);
                                line.setUpdatedBy(actor);
                                returnLineRepository.save(line);

                                saveLedger(source, MovementType.MATERIAL_RETURN_ROUTE_OUT,
                                                availableToForward.negate(), ZERO, blockedReleased.negate(),
                                                availableToForward,
                                                materialReturn, line,
                                                "Origin Plant Store forwarded return to AL-P1 Main Store", actor);
                        }

                        materialReturn.status = MaterialReturnStatus.IN_TRANSIT_TO_MAIN_STORE;
                        materialReturn.forwardedBy = actor;
                        materialReturn.forwardedAt = LocalDateTime.now();
                        applyRemarks(materialReturn, request == null ? null : request.remarks());
                        materialReturn.setUpdatedBy(actor);
                        materialReturn = returnRepository.saveAndFlush(materialReturn);

                        auditService.record(
                                        "MATERIAL_RETURN", materialReturn.getId(),
                                        "RETURN_FORWARDED_TO_MAIN_STORE",
                                        originPlant,
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "returnNumber", materialReturn.returnNumber,
                                                        "from", materialReturn.viaLocation.getLocationCode(),
                                                        "to", materialReturn.toLocation.getLocationCode(),
                                                        "forwardedBy", actor));

                        return toResponse(materialReturn);
                }

                /**
                 * Context-aware receipt:
                 * IN_TRANSIT_TO_ORIGIN_STORE -> origin Store acknowledges first leg.
                 * IN_TRANSIT_TO_MAIN_STORE -> AL-P1 acknowledges final leg and only then
                 * increments requisitionLine.returnedQty.
                 * Legacy IN_TRANSIT/PARTIALLY_RECEIVED rows retain the historical one-leg
                 * receive behavior.
                 */
                @Transactional
                public MaterialReturnResponse receive(UUID id, MaterialReturnActionRequest request) {
                        MatFlowMaterialReturn materialReturn = requireReturn(id);
                        MatFlowMaterialRequisition requisition = requireReturnRequisition(materialReturn);
                        assertVersion(request == null ? null : request.rowVersion(),
                                        materialReturn.getRowVersion(), "Material return");

                        if (materialReturn.status == MaterialReturnStatus.IN_TRANSIT_TO_ORIGIN_STORE) {
                                return receiveAtOriginStore(materialReturn, requisition, request);
                        }
                        if (materialReturn.status == MaterialReturnStatus.IN_TRANSIT_TO_MAIN_STORE) {
                                return receiveAtMainStore(materialReturn, requisition, request, false);
                        }
                        if (materialReturn.status == MaterialReturnStatus.IN_TRANSIT
                                        || materialReturn.status == MaterialReturnStatus.PARTIALLY_RECEIVED) {
                                return receiveAtMainStore(materialReturn, requisition, request, true);
                        }

                        throw conflict("Material return is not available for receipt in status: " + materialReturn.status);
                }

                private MaterialReturnResponse receiveAtOriginStore(
                                MatFlowMaterialReturn materialReturn,
                                MatFlowMaterialRequisition requisition,
                                MaterialReturnActionRequest request) {
                        if (materialReturn.viaLocation == null) {
                                throw conflict("Remote return origin Store is missing");
                        }
                        String originPlant = plantRoutingService.normalizeFactoryPlant(
                                        materialReturn.viaLocation.getPlantCode());
                        plantRoutingService.requireOriginStoreActor(originPlant);
                        plantRoutingService.assertOriginStoreLocation(
                                        materialReturn.viaLocation, originPlant, "Material return receipt");

                        String actor = accessService.actor();
                        List<MatFlowMaterialReturnLine> lines = requireReturnLines(materialReturn.getId());
                        for (MatFlowMaterialReturnLine line : lines) {
                                BigDecimal outstanding = zero(line.dispatchedQty)
                                                .subtract(zero(line.originStoreReceivedQty))
                                                .max(ZERO)
                                                .setScale(3, RoundingMode.HALF_UP);
                                if (outstanding.compareTo(ZERO) <= 0) {
                                        continue;
                                }

                                MatFlowStockBalance production = stockRepository
                                                .lockBalance(line.material.getId(), materialReturn.fromLocation.getId())
                                                .orElseThrow(() -> conflict("Production return in-transit balance not found"));
                                if (zero(production.inTransitQty).compareTo(outstanding) < 0) {
                                        throw conflict("Production in-transit return quantity is inconsistent");
                                }
                                production.inTransitQty = zero(production.inTransitQty).subtract(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);
                                production.setUpdatedBy(actor);
                                production = stockRepository.save(production);

                                MatFlowStockBalance originStoreBalance = lockOrCreateBalance(
                                                line.material, materialReturn.viaLocation, actor);
                                originStoreBalance.onHandQty = zero(originStoreBalance.onHandQty).add(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);
                                /*
                                 * This is transit custody, not local planning stock. Keep the
                                 * lot blocked until the origin Store forwards it to AL-P1.
                                 */
                                originStoreBalance.blockedQty = zero(originStoreBalance.blockedQty).add(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);
                                originStoreBalance.setUpdatedBy(actor);
                                originStoreBalance = stockRepository.save(originStoreBalance);

                                line.originStoreReceivedQty = zero(line.originStoreReceivedQty).add(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);
                                line.setUpdatedBy(actor);
                                returnLineRepository.save(line);

                                saveLedger(production, MovementType.MATERIAL_RETURN_ROUTE_RECEIPT_CLEAR,
                                                ZERO, ZERO, ZERO, outstanding.negate(),
                                                materialReturn, line,
                                                "Return transit cleared at origin Plant Store", actor);
                                saveLedger(originStoreBalance, MovementType.MATERIAL_RETURN_ROUTE_IN,
                                                outstanding, ZERO, outstanding, ZERO,
                                                materialReturn, line,
                                                "Return received at origin Plant Store; blocked while awaiting forward to AL-P1", actor);
                        }

                        materialReturn.status = MaterialReturnStatus.AT_ORIGIN_STORE;
                        materialReturn.originStoreReceivedBy = actor;
                        materialReturn.originStoreReceivedAt = LocalDateTime.now();
                        applyRemarks(materialReturn, request == null ? null : request.remarks());
                        materialReturn.setUpdatedBy(actor);
                        materialReturn = returnRepository.saveAndFlush(materialReturn);

                        auditService.record(
                                        "MATERIAL_RETURN", materialReturn.getId(),
                                        "RETURN_RECEIVED_AT_ORIGIN_STORE",
                                        originPlant,
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "returnNumber", materialReturn.returnNumber,
                                                        "originStore", materialReturn.viaLocation.getLocationCode(),
                                                        "nextStore", materialReturn.toLocation.getLocationCode()));

                        return toResponse(materialReturn);
                }

                private MaterialReturnResponse receiveAtMainStore(
                                MatFlowMaterialReturn materialReturn,
                                MatFlowMaterialRequisition requisition,
                                MaterialReturnActionRequest request,
                                boolean legacyOneLeg) {
                        MatFlowLocation finalStore = materialReturn.toLocation;
                        if (!legacyOneLeg) {
                                plantRoutingService.requireMainStorePlanningActor();
                                plantRoutingService.assertMainStoreLocation(finalStore, "Material return final receipt");
                        } else {
                                accessService.requireTransferReceive(finalStore);
                        }

                        MatFlowLocation transitSource = materialReturn.viaLocation != null
                                        && zeroForwardedTotal(materialReturn.getId()).compareTo(ZERO) > 0
                                                        ? materialReturn.viaLocation
                                                        : materialReturn.fromLocation;
                        String actor = accessService.actor();
                        List<MatFlowMaterialReturnLine> lines = requireReturnLines(materialReturn.getId());

                        for (MatFlowMaterialReturnLine line : lines) {
                                BigDecimal dispatchedOnCurrentLeg = materialReturn.viaLocation != null
                                                && zero(line.forwardedQty).compareTo(ZERO) > 0
                                                                ? zero(line.forwardedQty)
                                                                : zero(line.dispatchedQty);
                                BigDecimal outstanding = dispatchedOnCurrentLeg
                                                .subtract(zero(line.receivedQty))
                                                .max(ZERO)
                                                .setScale(3, RoundingMode.HALF_UP);
                                if (outstanding.compareTo(ZERO) <= 0) {
                                        continue;
                                }

                                MatFlowStockBalance source = stockRepository
                                                .lockBalance(line.material.getId(), transitSource.getId())
                                                .orElseThrow(() -> conflict("Return source in-transit balance not found"));
                                if (zero(source.inTransitQty).compareTo(outstanding) < 0) {
                                        throw conflict("Return source in-transit quantity is inconsistent for "
                                                        + line.material.getMaterialCode());
                                }
                                source.inTransitQty = zero(source.inTransitQty).subtract(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);
                                source.setUpdatedBy(actor);
                                source = stockRepository.save(source);

                                MatFlowStockBalance destination = lockOrCreateBalance(
                                                line.material, finalStore, actor);
                                destination.onHandQty = zero(destination.onHandQty).add(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);

                                BigDecimal blockedAdded = ZERO;
                                if (materialReturn.reason == MaterialReturnReason.DAMAGED
                                                || materialReturn.reason == MaterialReturnReason.PROCESS_REJECTED
                                                || materialReturn.reason == MaterialReturnReason.QC_REJECTED) {
                                        destination.blockedQty = zero(destination.blockedQty).add(outstanding)
                                                        .setScale(3, RoundingMode.HALF_UP);
                                        blockedAdded = outstanding;
                                }
                                destination.setUpdatedBy(actor);
                                destination = stockRepository.save(destination);

                                line.receivedQty = zero(line.receivedQty).add(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);
                                line.setUpdatedBy(actor);
                                returnLineRepository.save(line);

                                MatFlowRequisitionLine requisitionLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                                line.requisitionLine);
                                requisitionLine.returnedQty = zero(requisitionLine.returnedQty).add(outstanding)
                                                .setScale(3, RoundingMode.HALF_UP);
                                requisitionLine.setUpdatedBy(actor);
                                requisitionLineRepository.save(requisitionLine);

                                MovementType clearType = transitSource.getId().equals(materialReturn.fromLocation.getId())
                                                ? MovementType.MATERIAL_RETURN_RECEIPT_CLEAR
                                                : MovementType.MATERIAL_RETURN_ROUTE_RECEIPT_CLEAR;
                                saveLedger(source, clearType,
                                                ZERO, ZERO, ZERO, outstanding.negate(),
                                                materialReturn, line,
                                                "Return transit cleared on final Main Store receipt", actor);
                                saveLedger(destination, MovementType.MATERIAL_RETURN_IN,
                                                outstanding, ZERO, blockedAdded, ZERO,
                                                materialReturn, line,
                                                "Returned material entered final Store custody", actor);
                        }

                        materialReturn.status = MaterialReturnStatus.RECEIVED;
                        materialReturn.receivedBy = actor;
                        materialReturn.receivedAt = LocalDateTime.now();
                        applyRemarks(materialReturn, request == null ? null : request.remarks());
                        materialReturn.setUpdatedBy(actor);
                        materialReturn = returnRepository.saveAndFlush(materialReturn);

                        auditService.record(
                                        "MATERIAL_RETURN", materialReturn.getId(),
                                        legacyOneLeg ? "LEGACY_MATERIAL_RETURN_RECEIVED" : "MATERIAL_RETURN_RECEIVED_AT_MAIN_STORE",
                                        finalStore.getPlantCode(),
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "returnNumber", materialReturn.returnNumber,
                                                        "status", materialReturn.status,
                                                        "finalStore", finalStore.getLocationCode()));

                        /* returnedQty changed only at final Store receipt; refresh the
                         * material/requisition state in the same transaction. */
                        requisitionService.refreshState(requisition.getId(), actor);

                        return toResponse(materialReturn);
                }

                private BigDecimal zeroForwardedTotal(UUID returnId) {
                        return returnLineRepository.findByMaterialReturn_IdOrderByCreatedAtAsc(returnId).stream()
                                        .map(line -> zero(line.forwardedQty))
                                        .reduce(ZERO, BigDecimal::add)
                                        .setScale(3, RoundingMode.HALF_UP);
                }

                /**
                 * Quantity already promised by a Draft/in-flight return for this
                 * requisition line. RECEIVED is excluded because returnedQty already
                 * contains it; CANCELLED is excluded because it no longer commits stock.
                 */
                private BigDecimal openCommittedReturnQtyForLine(UUID requisitionLineId) {
                        if (requisitionLineId == null) {
                                return ZERO;
                        }

                        BigDecimal total = ZERO;
                        for (MatFlowMaterialReturnLine rawLine : returnLineRepository
                                        .findByRequisitionLine_IdOrderByCreatedAtAsc(requisitionLineId)) {
                                if (rawLine == null) {
                                        continue;
                                }
                                MatFlowMaterialReturnLine line = (MatFlowMaterialReturnLine) Hibernate.unproxy(rawLine);
                                if (line.materialReturn == null) {
                                        continue;
                                }
                                MatFlowMaterialReturn header = (MatFlowMaterialReturn) Hibernate.unproxy(
                                                line.materialReturn);
                                if (header.status == MaterialReturnStatus.RECEIVED
                                                || header.status == MaterialReturnStatus.CANCELLED) {
                                        continue;
                                }
                                total = total.add(zero(line.returnQty)).setScale(3, RoundingMode.HALF_UP);
                        }
                        return total;
                }

                private BigDecimal productionWasteForLine(UUID requisitionLineId) {
                        if (requisitionLineId == null) {
                                return ZERO;
                        }
                        return ledgerRepository.findAll().stream()
                                        .filter(entry -> entry != null && entry.movementType == MovementType.SCRAP)
                                        .filter(entry -> "MATFLOW_PRODUCTION_WASTE".equals(entry.referenceType))
                                        .filter(entry -> requisitionLineId.equals(entry.referenceId))
                                        .map(entry -> zero(entry.quantityChange).abs())
                                        .reduce(ZERO, BigDecimal::add)
                                        .setScale(3, RoundingMode.HALF_UP);
                }

                private List<MatFlowMaterialReturnLine> requireReturnLines(UUID returnId) {
                        List<MatFlowMaterialReturnLine> lines = returnLineRepository
                                        .findByMaterialReturn_IdOrderByCreatedAtAsc(returnId).stream()
                                        .map(value -> (MatFlowMaterialReturnLine) Hibernate.unproxy(value))
                                        .toList();
                        if (lines.isEmpty()) {
                                throw conflict("Material return has no lines");
                        }
                        for (MatFlowMaterialReturnLine line : lines) {
                                if (line.material == null || line.requisitionLine == null) {
                                        throw conflict("Material return contains an incomplete line");
                                }
                                line.material = (MatFlowMaterial) Hibernate.unproxy(line.material);
                                line.requisitionLine = (MatFlowRequisitionLine) Hibernate.unproxy(line.requisitionLine);
                        }
                        return lines;
                }

                private MatFlowMaterialReturn requireReturn(UUID id) {
                        if (id == null) {
                                throw badRequest("Material return ID is required");
                        }
                        MatFlowMaterialReturn materialReturn = returnRepository.lockDetailById(id)
                                        .map(this::hydrateReturn)
                                        .orElseThrow(() -> notFound("Material return not found"));
                        if (!canReadReturn(materialReturn)) {
                                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to this material return");
                        }
                        return materialReturn;
                }

                private MatFlowMaterialReturn hydrateReturn(MatFlowMaterialReturn raw) {
                        if (raw == null) {
                                return null;
                        }
                        MatFlowMaterialReturn materialReturn = (MatFlowMaterialReturn) Hibernate.unproxy(raw);
                        if (materialReturn.fromLocation != null) {
                                materialReturn.fromLocation = hydrateLocation(materialReturn.fromLocation);
                        }
                        if (materialReturn.viaLocation != null) {
                                materialReturn.viaLocation = hydrateLocation(materialReturn.viaLocation);
                        }
                        if (materialReturn.toLocation != null) {
                                materialReturn.toLocation = hydrateLocation(materialReturn.toLocation);
                        }
                        if (materialReturn.requisition != null && materialReturn.requisition.getId() != null) {
                                materialReturn.requisition = requisitionRepository.findDetailById(materialReturn.requisition.getId())
                                                .map(value -> (MatFlowMaterialRequisition) Hibernate.unproxy(value))
                                                .orElseThrow(() -> conflict("Material return requisition no longer exists"));
                                hydrateRequisitionAssociations(materialReturn.requisition);
                        }
                        return materialReturn;
                }

                private boolean canReadReturn(MatFlowMaterialReturn materialReturn) {
                        if (materialReturn == null) {
                                return false;
                        }
                        return canAccessLocation(materialReturn.fromLocation)
                                        || canAccessLocation(materialReturn.viaLocation)
                                        || canAccessLocation(materialReturn.toLocation);
                }

                private boolean canAccessLocation(MatFlowLocation location) {
                        return location != null && accessService.canAccessPlant(location.getPlantCode());
                }

                private MatFlowMaterialRequisition requireReturnRequisition(MatFlowMaterialReturn materialReturn) {
                        if (materialReturn == null || materialReturn.requisition == null
                                        || materialReturn.requisition.getId() == null) {
                                throw conflict("Material return requisition is missing");
                        }
                        MatFlowMaterialRequisition requisition = requisitionRepository
                                        .findDetailById(materialReturn.requisition.getId())
                                        .map(value -> (MatFlowMaterialRequisition) Hibernate.unproxy(value))
                                        .orElseThrow(() -> conflict("Material return requisition no longer exists"));
                        hydrateRequisitionAssociations(requisition);
                        validateReturnRequisition(requisition);
                        materialReturn.requisition = requisition;
                        return requisition;
                }

                private void hydrateRequisitionAssociations(MatFlowMaterialRequisition requisition) {
                        if (requisition == null) {
                                return;
                        }
                        if (requisition.projectDrawing != null) {
                                requisition.projectDrawing = (MatFlowProjectDrawing) Hibernate.unproxy(requisition.projectDrawing);
                        }
                        if (requisition.bom != null) {
                                requisition.bom = (MatFlowBom) Hibernate.unproxy(requisition.bom);
                        }
                        if (requisition.destinationLocation != null) {
                                requisition.destinationLocation = hydrateLocation(requisition.destinationLocation);
                        }
                        if (requisition.originStore != null) {
                                requisition.originStore = hydrateLocation(requisition.originStore);
                        }
                        if (requisition.mainStore != null) {
                                requisition.mainStore = hydrateLocation(requisition.mainStore);
                        }
                }

                private void validateReturnRequisition(MatFlowMaterialRequisition requisition) {
                        if (requisition == null) {
                                throw conflict("Material return requisition is missing");
                        }
                        if (requisition.projectDrawing == null) {
                                throw conflict("Material return requisition has no Project/Drawing master: "
                                                + requisition.requisitionNumber);
                        }
                        if (requisition.bom == null) {
                                throw conflict("Material return requisition has no operational BOM: "
                                                + requisition.requisitionNumber);
                        }
                        if (requisition.destinationLocation == null) {
                                throw conflict("Material return requisition has no Production destination: "
                                                + requisition.requisitionNumber);
                        }
                        if (requisition.destinationLocation.getLocationType() != LocationType.PRODUCTION) {
                                throw conflict("Material return requisition destination is not Production");
                        }
                }

                private MatFlowLocation requireAccessibleLocation(UUID id) {
                        if (id == null) {
                                throw badRequest("Location is required");
                        }
                        MatFlowLocation location = locationRepository.findById(id)
                                        .map(value -> (MatFlowLocation) Hibernate.unproxy(value))
                                        .orElseThrow(() -> notFound("Location not found"));
                        accessService.requirePlantAccess(location.getPlantCode());
                        if (!location.isActive()) {
                                throw badRequest("Inactive location cannot be used");
                        }
                        return location;
                }

                private MatFlowLocation hydrateLocation(MatFlowLocation location) {
                        if (location == null || location.getId() == null) {
                                return location;
                        }
                        return locationRepository.findById(location.getId())
                                        .map(value -> (MatFlowLocation) Hibernate.unproxy(value))
                                        .orElseThrow(() -> conflict("Referenced MatFlow location no longer exists"));
                }

                private MatFlowStockBalance lockOrCreateBalance(
                                MatFlowMaterial material,
                                MatFlowLocation location,
                                String actor) {
                        MatFlowStockBalance balance = stockRepository
                                        .lockBalance(material.getId(), location.getId())
                                        .orElse(null);
                        if (balance != null) {
                                return balance;
                        }
                        MatFlowStockBalance created = new MatFlowStockBalance();
                        created.material = material;
                        created.location = location;
                        created.onHandQty = ZERO;
                        created.reservedQty = ZERO;
                        created.blockedQty = ZERO;
                        created.inTransitQty = ZERO;
                        created.setCreatedBy(actor);
                        created.setUpdatedBy(actor);
                        return stockRepository.saveAndFlush(created);
                }

                private MaterialReturnResponse toResponse(MatFlowMaterialReturn raw) {
                        MatFlowMaterialReturn materialReturn = hydrateReturn(raw);
                        MatFlowMaterialRequisition requisition = requireReturnRequisition(materialReturn);

                        List<MaterialReturnLineResponse> lines = requireReturnLines(materialReturn.getId()).stream()
                                        .map(line -> new MaterialReturnLineResponse(
                                                        line.getId(),
                                                        line.requisitionLine.getId(),
                                                        line.material.getId(),
                                                        line.material.getMaterialCode(),
                                                        line.material.getMaterialName(),
                                                        zero(line.returnQty),
                                                        zero(line.dispatchedQty),
                                                        zero(line.originStoreReceivedQty),
                                                        zero(line.forwardedQty),
                                                        zero(line.receivedQty),
                                                        line.uom,
                                                        line.batchNo,
                                                        line.getRowVersion()))
                                        .toList();

                        return new MaterialReturnResponse(
                                        materialReturn.getId(),
                                        materialReturn.returnNumber,
                                        requisition.getId(),
                                        requisition.requisitionNumber,
                                        materialReturn.fromLocation.getPlantCode(),
                                        requisition.requestedBy,
                                        materialReturn.viaLocation == null ? null : materialReturn.viaLocation.getPlantCode(),
                                        materialReturn.toLocation.getPlantCode(),
                                        materialReturn.reason,
                                        materialReturn.status,
                                        materialReturn.dispatchedBy,
                                        materialReturn.dispatchedAt,
                                        materialReturn.originStoreReceivedBy,
                                        materialReturn.originStoreReceivedAt,
                                        materialReturn.forwardedBy,
                                        materialReturn.forwardedAt,
                                        materialReturn.receivedBy,
                                        materialReturn.receivedAt,
                                        materialReturn.remarks,
                                        materialReturn.getRowVersion(),
                                        lines);
                }

                private void validateCreateRequest(MaterialReturnCreateRequest request) {
                        if (request == null
                                        || request.requisitionId() == null
                                        || request.reason() == null
                                        || request.lines() == null
                                        || request.lines().isEmpty()) {
                                throw badRequest("Requisition, reason and return lines are required");
                        }
                }

                private void saveLedger(
                                MatFlowStockBalance balance,
                                MovementType movementType,
                                BigDecimal quantityChange,
                                BigDecimal reservedChange,
                                BigDecimal blockedChange,
                                BigDecimal transitChange,
                                MatFlowMaterialReturn materialReturn,
                                MatFlowMaterialReturnLine line,
                                String remarks,
                                String actor) {
                        MatFlowMaterialRequisition requisition = requireReturnRequisition(materialReturn);
                        MatFlowStockLedger ledger = new MatFlowStockLedger();
                        ledger.material = balance.material;
                        ledger.location = balance.location;
                        ledger.movementType = movementType;
                        ledger.quantityChange = zero(quantityChange);
                        ledger.reservedChange = zero(reservedChange);
                        ledger.blockedChange = zero(blockedChange);
                        ledger.inTransitChange = zero(transitChange);
                        ledger.onHandAfter = zero(balance.onHandQty);
                        ledger.reservedAfter = zero(balance.reservedQty);
                        ledger.blockedAfter = zero(balance.blockedQty);
                        ledger.inTransitAfter = zero(balance.inTransitQty);
                        ledger.referenceType = "MATFLOW_MATERIAL_RETURN";
                        ledger.referenceId = materialReturn.getId();
                        ledger.referenceNumber = materialReturn.returnNumber;
                        ledger.projectCode = requisition.projectDrawing == null
                                        ? null : requisition.projectDrawing.getProjectCode();
                        ledger.drawingNo = requisition.projectDrawing == null
                                        ? null : requisition.projectDrawing.getDrawingNo();
                        ledger.batchNo = line == null ? null : line.batchNo;
                        ledger.remarks = clean(remarks);
                        ledger.actor = actor;
                        ledgerRepository.save(ledger);
                }

                private void applyRemarks(MatFlowMaterialReturn materialReturn, String remarks) {
                        String value = clean(remarks);
                        if (value != null) {
                                materialReturn.remarks = value;
                        }
                }

                private BigDecimal positive(BigDecimal value, String field) {
                        BigDecimal result = zero(value);
                        if (result.compareTo(ZERO) <= 0) {
                                throw badRequest(field + " must be greater than zero");
                        }
                        return result;
                }

                private BigDecimal zero(BigDecimal value) {
                        return value == null ? ZERO : value.setScale(3, RoundingMode.HALF_UP);
                }

                private String generateNumber(String prefix) {
                        return prefix + "-" + LocalDate.now().getYear() + "-"
                                        + UUID.randomUUID().toString().replace("-", "")
                                                        .substring(0, 8).toUpperCase(Locale.ROOT);
                }

                private void assertVersion(Long requested, Long current, String entity) {
                        if (requested == null) {
                                throw badRequest(entity + " rowVersion is required");
                        }
                        if (!requested.equals(current)) {
                                throw conflict(entity + " was modified by another user. Refresh and retry.");
                        }
                }

                private String clean(String value) {
                        if (value == null) {
                                return null;
                        }
                        String result = value.trim();
                        return result.isBlank() ? null : result;
                }

                private ResponseStatusException badRequest(String message) {
                        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
                }

                private ResponseStatusException conflict(String message) {
                        return new ResponseStatusException(HttpStatus.CONFLICT, message);
                }

                private ResponseStatusException notFound(String message) {
                        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
                }
        }

}
