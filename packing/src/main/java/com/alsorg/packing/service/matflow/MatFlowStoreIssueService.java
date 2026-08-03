package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;

import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;

import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
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
public class MatFlowStoreIssueService {

    private final MatFlowReservationRepository
            reservationRepository;

    private final MatFlowRequisitionLineRepository
            requisitionLineRepository;

    private final MatFlowTransferOrderRepository
            transferRepository;

    private final MatFlowStockBalanceRepository
            stockRepository;

    private final MatFlowStockLedgerRepository
            ledgerRepository;

    private final MatFlowPlanningService
            planningService;

    private final MatFlowRequisitionStateService
            requisitionStateService;

    private final MatFlowAccessService
            accessService;

    private final MatFlowAuditService
            auditService;

    public MatFlowStoreIssueService(
            MatFlowReservationRepository reservationRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowTransferOrderRepository transferRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowPlanningService planningService,
            MatFlowRequisitionStateService requisitionStateService,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService) {

        this.reservationRepository =
                reservationRepository;

        this.requisitionLineRepository =
                requisitionLineRepository;

        this.transferRepository =
                transferRepository;

        this.stockRepository =
                stockRepository;

        this.ledgerRepository =
                ledgerRepository;

        this.planningService =
                planningService;

        this.requisitionStateService =
                requisitionStateService;

        this.accessService =
                accessService;

        this.auditService =
                auditService;
    }

    @Transactional
    public PlanningResponse issue(
            UUID reservationId,
            StoreIssueRequest request) {

        accessService.requireStoreIssue();

        if (reservationId == null) {
            throw badRequest(
                    "Reservation ID is required");
        }

        if (request == null) {
            throw badRequest(
                    "Store issue request is required");
        }

        MatFlowReservation reservation =
                reservationRepository
                        .lockById(
                                reservationId)
                        .orElseThrow(() ->
                                notFound(
                                        "Reservation not found"));

        if (reservation.requisitionLine == null ||
                reservation.material == null) {

            throw conflict(
                    "Reservation is incomplete");
        }

        MatFlowRequisitionLine line =
                requisitionLineRepository
                        .lockById(
                                reservation.requisitionLine
                                        .getId())
                        .orElseThrow(() ->
                                conflict(
                                        "Requisition line no longer exists"));

        if (line.requisition == null ||
                line.requisition.destinationLocation == null) {

            throw conflict(
                    "Requisition Production destination is missing");
        }

        MatFlowMaterialRequisition requisition =
                line.requisition;

        MatFlowLocation issueLocation =
                requisition.destinationLocation;

        accessService.requirePlantAccess(
                issueLocation.getPlantCode());

        assertVersion(
                request.rowVersion(),
                reservation.getRowVersion(),
                "Reservation");

        if (reservation.status !=
                        ReservationStatus.ACTIVE &&
                reservation.status !=
                        ReservationStatus.PARTIALLY_ISSUED) {

            throw conflict(
                    "Reservation cannot be issued in status: " +
                            reservation.status);
        }

        if (!isIssueReady(
                reservation,
                issueLocation)) {

            throw conflict(
                    "Material has not completed its approved route to the Production issue location");
        }

        BigDecimal remaining =
                zero(
                        reservation.reservedQty)
                        .subtract(
                                zero(
                                        reservation.issuedQty))
                        .max(
                                BigDecimal.ZERO)
                        .setScale(
                                3,
                                RoundingMode.HALF_UP);

        if (remaining.compareTo(
                BigDecimal.ZERO) <= 0) {

            throw conflict(
                    "Reservation has no remaining quantity to issue");
        }

        BigDecimal quantity =
                request.quantity() == null
                        ? remaining
                        : positive(
                                request.quantity(),
                                "Issue quantity");

        if (quantity.compareTo(
                remaining) > 0) {

            throw badRequest(
                    "Issue quantity cannot exceed the remaining reserved quantity of " +
                            remaining);
        }

        MatFlowStockBalance productionBalance =
                stockRepository
                        .lockBalance(
                                reservation.material
                                        .getId(),

                                issueLocation
                                        .getId())
                        .orElseThrow(() ->
                                conflict(
                                        "Production stock balance does not exist for the reserved material"));

        BigDecimal reservedAtProduction =
                zero(
                        productionBalance.reservedQty);

        if (reservedAtProduction.compareTo(
                quantity) < 0) {

            throw conflict(
                    "Production reserved stock is lower than the requested issue quantity");
        }

        productionBalance.reservedQty =
                reservedAtProduction
                        .subtract(
                                quantity)
                        .setScale(
                                3,
                                RoundingMode.HALF_UP);

        productionBalance.setUpdatedBy(
                accessService.actor());

        stockRepository.save(
                productionBalance);

        reservation.issuedQty =
                zero(
                        reservation.issuedQty)
                        .add(
                                quantity)
                        .setScale(
                                3,
                                RoundingMode.HALF_UP);

        reservation.status =
                reservation.issuedQty
                                .compareTo(
                                        zero(
                                                reservation.reservedQty)) >= 0
                        ? ReservationStatus.ISSUED
                        : ReservationStatus.PARTIALLY_ISSUED;

        String actor =
                accessService.actor();

        reservation.setUpdatedBy(
                actor);

        reservationRepository.save(
                reservation);

        line.issuedQty =
                zero(
                        line.issuedQty)
                        .add(
                                quantity)
                        .setScale(
                                3,
                                RoundingMode.HALF_UP);

        line.setUpdatedBy(
                actor);

        requisitionLineRepository.save(
                line);

        saveIssueLedger(
                productionBalance,
                requisition,
                reservation,
                quantity,
                request,
                actor);

        auditService.record(
                "REQUISITION",
                requisition.getId(),
                "MATERIAL_ISSUED_TO_PRODUCTION",

                issueLocation.getPlantCode(),

                requisition.projectDrawing
                        .getProjectCode(),

                requisition.projectDrawing
                        .getDrawingNo(),

                auditService.details(
                        "reservationId",
                        reservation.getId(),

                        "requisitionLineId",
                        line.getId(),

                        "materialId",
                        reservation.material
                                .getId(),

                        "materialCode",
                        reservation.material
                                .getMaterialCode(),

                        "quantity",
                        quantity,

                        "batchNo",
                        clean(
                                request.batchNo()),

                        "remarks",
                        clean(
                                request.remarks())));

        requisitionStateService.refresh(
                requisition.getId(),
                actor);

        return planningService
                .getPlanningSnapshot(
                        requisition.getId());
    }

    public boolean isIssueReady(
            MatFlowReservation reservation,
            MatFlowLocation productionDestination) {

        if (reservation == null ||
                reservation.getId() == null ||
                reservation.sourceLocation == null ||
                productionDestination == null) {

            return false;
        }

        List<MatFlowTransferOrder> transfers =
                transferRepository
                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                reservation.getId());

        if (transfers == null ||
                transfers.isEmpty()) {

            return reservation.sourceLocation
                    .getId()
                    .equals(
                            productionDestination
                                    .getId());
        }

        MatFlowTransferOrder finalTransfer =
                transfers.get(
                        transfers.size() - 1);

        return finalTransfer.toLocation != null &&
                finalTransfer.toLocation
                        .getId()
                        .equals(
                                productionDestination
                                        .getId()) &&
                finalTransfer.status ==
                        TransferStatus.RECEIVED;
    }

    private void saveIssueLedger(
            MatFlowStockBalance balance,
            MatFlowMaterialRequisition requisition,
            MatFlowReservation reservation,
            BigDecimal quantity,
            StoreIssueRequest request,
            String actor) {

        MatFlowStockLedger ledger =
                new MatFlowStockLedger();

        ledger.material =
                balance.material;

        ledger.location =
                balance.location;

        ledger.movementType =
                MovementType.ISSUE_TO_PRODUCTION;

        /*
         * Physical quantity remains at the Production
         * location until Production records consumption.
         */
        ledger.quantityChange =
                BigDecimal.ZERO;

        ledger.reservedChange =
                quantity.negate();

        ledger.blockedChange =
                BigDecimal.ZERO;

        ledger.inTransitChange =
                BigDecimal.ZERO;

        ledger.onHandAfter =
                zero(
                        balance.onHandQty);

        ledger.reservedAfter =
                zero(
                        balance.reservedQty);

        ledger.blockedAfter =
                zero(
                        balance.blockedQty);

        ledger.inTransitAfter =
                zero(
                        balance.inTransitQty);

        ledger.referenceType =
                "MATFLOW_STORE_ISSUE";

        ledger.referenceId =
                reservation.getId();

        ledger.referenceNumber =
                requisition.requisitionNumber;

        ledger.projectCode =
                requisition.projectDrawing
                        .getProjectCode();

        ledger.drawingNo =
                requisition.projectDrawing
                        .getDrawingNo();

        ledger.remarks =
                clean(
                        request.remarks());

        ledger.actor =
                actor;

        ledgerRepository.save(
                ledger);
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

        return value.setScale(
                3,
                RoundingMode.HALF_UP);
    }

    private BigDecimal zero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO.setScale(
                        3,
                        RoundingMode.HALF_UP)
                : value.setScale(
                        3,
                        RoundingMode.HALF_UP);
    }

    private String clean(
            String value) {

        if (value == null) {
            return null;
        }

        String result =
                value.trim();

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