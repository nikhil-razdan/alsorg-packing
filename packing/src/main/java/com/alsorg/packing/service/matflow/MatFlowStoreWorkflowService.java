package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineAvailabilityResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreStockOptionResponse;

import com.alsorg.packing.domain.matflow.MatFlowBomRouteStep;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;

import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowStoreWorkflowService {

    /*
     * String-based status checks intentionally support both
     * old and new requisition enum values during migration.
     */
    private static final Set<String> STORE_QUEUE_STATUS_NAMES = Set.of(
            "SUBMITTED",
            "SUBMITTED_TO_STORE",
            "STORE_REVIEW_IN_PROGRESS",
            "PLANNED",
            "PARTIALLY_RESERVED",
            "SHORTAGE_PENDING",
            "READY_TO_ISSUE",
            "PARTIALLY_ISSUED",
            "ISSUED",
            "ISSUED_TO_PRODUCTION");

    private static final Set<String> STORE_REVIEWABLE_STATUS_NAMES = Set.of(
            "SUBMITTED",
            "SUBMITTED_TO_STORE",
            "STORE_REVIEW_IN_PROGRESS");

    /*
     * Keep this synchronized with the source types used by
     * MatFlowPlanningService.
     *
     * Do not show locations as selectable availability when
     * the planner itself will not use those locations.
     */
    private static final Set<LocationType> AVAILABILITY_SOURCE_TYPES = EnumSet.of(
            LocationType.STORE,
            LocationType.PRODUCTION,
            LocationType.PROCESSING,
            LocationType.EXTERNAL_PROCESSOR);

    private final MatFlowMaterialRequisitionRepository requisitionRepository;

    private final MatFlowRequisitionLineRepository requisitionLineRepository;

    private final MatFlowStockBalanceRepository stockRepository;

    private final MatFlowReservationRepository reservationRepository;

    private final MatFlowTransferOrderRepository transferRepository;

    private final MatFlowIndentRepository indentRepository;

    private final MatFlowPlanningService planningService;

    private final MatFlowRoutingService routingService;

    private final MatFlowAccessService accessService;

    private final MatFlowAuditService auditService;

    public MatFlowStoreWorkflowService(
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowReservationRepository reservationRepository,
            MatFlowTransferOrderRepository transferRepository,
            MatFlowIndentRepository indentRepository,
            MatFlowPlanningService planningService,
            MatFlowRoutingService routingService,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService) {

        this.requisitionRepository = requisitionRepository;

        this.requisitionLineRepository = requisitionLineRepository;

        this.stockRepository = stockRepository;

        this.reservationRepository = reservationRepository;

        this.transferRepository = transferRepository;

        this.indentRepository = indentRepository;

        this.planningService = planningService;

        this.routingService = routingService;

        this.accessService = accessService;

        this.auditService = auditService;
    }

    /*
     * =====================================================
     * STORE QUEUE
     * =====================================================
     */

    @Transactional(readOnly = true)
    public List<RequisitionResponse> listStoreQueue(
            String plantCode) {

        accessService.requireStore();

        String normalizedPlant = cleanUpper(
                plantCode);

        if (normalizedPlant != null) {
            accessService.requirePlantAccess(
                    normalizedPlant);
        }

        return planningService
                .listRequisitions()
                .stream()
                .filter(
                        this::isStoreQueueStatus)
                .filter(response -> normalizedPlant == null
                        ||
                        normalizedPlant.equalsIgnoreCase(
                                response.destinationPlantCode()))
                .toList();
    }

    /*
     * =====================================================
     * STORE DETAIL
     * =====================================================
     */

    @Transactional(readOnly = true)
    public PlanningResponse getStorePlanning(
            UUID requisitionId) {

        accessService.requireStore();

        requireVisibleRequisition(
                requisitionId,
                false);

        return planningService
                .getPlanningSnapshot(
                        requisitionId);
    }

    /*
     * =====================================================
     * AVAILABILITY
     * =====================================================
     */

    @Transactional(readOnly = true)
    public List<StoreLineAvailabilityResponse> getAvailability(
            UUID requisitionId) {

        accessService.requireStore();

        MatFlowMaterialRequisition requisition = requireVisibleRequisition(
                requisitionId,
                false);

        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                .findByRequisition_IdOrderByLineNoAsc(
                        requisition.getId());

        return lines.stream()
                .map(line -> toAvailabilityResponse(
                        requisition,
                        line))
                .toList();
    }

    private StoreLineAvailabilityResponse toAvailabilityResponse(
            MatFlowMaterialRequisition requisition,
            MatFlowRequisitionLine line) {

        if (line == null ||
                line.material == null ||
                line.bomLine == null) {

            throw conflict(
                    "Requisition contains an incomplete material line");
        }

        List<MatFlowBomRouteStep> returnedRoute = routingService.routeForLine(
                line.bomLine.getId());

        List<MatFlowBomRouteStep> route = returnedRoute == null
                ? List.of()
                : returnedRoute;

        MatFlowLocation firstDestination = route.isEmpty()
                ? requisition.destinationLocation
                : route.get(0).location;

        if (firstDestination == null ||
                firstDestination.getId() == null) {

            throw conflict(
                    "Approved material route has no first destination");
        }

        List<MatFlowStockBalance> returnedBalances = stockRepository.findPlanningCandidates(
                line.material.getId(),
                accessService.allowedPlants(),
                AVAILABILITY_SOURCE_TYPES);

        List<MatFlowStockBalance> balances = returnedBalances == null
                ? new ArrayList<>()
                : new ArrayList<>(
                        returnedBalances);

        balances.removeIf(balance -> balance == null ||
                balance.location == null ||
                balance.location.getId() == null);

        balances.sort(
                Comparator
                        .<MatFlowStockBalance>comparingInt(
                                balance -> balance.location
                                        .getId()
                                        .equals(
                                                firstDestination
                                                        .getId())
                                                                ? 0
                                                                : 1)
                        .thenComparingInt(
                                balance -> samePlant(
                                        balance.location,
                                        firstDestination)
                                                ? 0
                                                : 1)
                        .thenComparing(
                                this::availableQty,
                                Comparator.reverseOrder())
                        .thenComparing(
                                balance -> balance.location
                                        .getLocationCode(),
                                Comparator.nullsLast(
                                        String.CASE_INSENSITIVE_ORDER)));

        List<StoreStockOptionResponse> options = balances.stream()
                .map(balance -> toStockOption(
                        requisition,
                        firstDestination,
                        balance))
                .toList();

        String materialCategory = clean(
                line.bomLine
                        .getMaterialCategorySnapshot());

        if (materialCategory == null) {
            materialCategory = "MISCELLANEOUS";
        }

        return new StoreLineAvailabilityResponse(
                line.getId(),
                line.lineNo,

                line.material.getId(),
                line.material.getMaterialCode(),
                line.material.getMaterialName(),
                materialCategory,
                line.material.getUom(),

                zero(
                        line.requestedQty),

                zero(
                        line.reservedQty),

                zero(
                        line.shortageQty),

                firstDestination.getId(),
                firstDestination.getLocationCode(),

                routeSummary(
                        route,
                        requisition.destinationLocation),

                options);
    }

    private StoreStockOptionResponse toStockOption(
            MatFlowMaterialRequisition requisition,
            MatFlowLocation firstDestination,
            MatFlowStockBalance balance) {

        boolean firstRouteDestination = balance.location
                .getId()
                .equals(
                        firstDestination
                                .getId());

        boolean productionDestination = balance.location
                .getId()
                .equals(
                        requisition.destinationLocation
                                .getId());

        return new StoreStockOptionResponse(
                balance.getId(),

                balance.material.getId(),
                balance.material.getMaterialCode(),
                balance.material.getMaterialName(),

                balance.location.getId(),
                balance.location.getLocationCode(),
                balance.location.getLocationName(),
                balance.location.getPlantCode(),
                balance.location.getLocationType(),

                zero(
                        balance.onHandQty),

                zero(
                        balance.reservedQty),

                zero(
                        balance.blockedQty),

                availableQty(
                        balance),

                firstRouteDestination,
                productionDestination,

                !firstRouteDestination);
    }

    /*
     * =====================================================
     * CONFIRM STORE REVIEW
     * =====================================================
     */

    @Transactional
    public PlanningResponse confirmStoreReview(
            UUID requisitionId,
            PlanningRequest request) {

        accessService.requireStore();

        if (request == null) {
            throw badRequest(
                    "Store review request is required");
        }

        MatFlowMaterialRequisition requisition = requireVisibleRequisition(
                requisitionId,
                true);

        assertVersion(
                request.rowVersion(),
                requisition.getRowVersion(),
                "Requisition");

        assertStoreReviewable(
                requisition);

        assertNotAlreadyPlanned(
                requisition);

        /*
         * The existing planning engine remains the only
         * component that creates:
         *
         * - stock reservations
         * - reservation ledgers
         * - transfer chains
         * - shortage quantities
         * - material indents
         */
        planningService.planRequisition(
                requisitionId,
                request);

        auditService.record(
                "REQUISITION",
                requisitionId,
                "STORE_REVIEW_CONFIRMED",

                requisition.destinationLocation
                        .getPlantCode(),

                requisition.projectDrawing
                        .getProjectCode(),

                requisition.projectDrawing
                        .getDrawingNo(),

                auditService.details(
                        "preferredSourceLocationIds",
                        request.preferredSourceLocationIds(),

                        "remarks",
                        clean(
                                request.remarks())));

        return planningService
                .getPlanningSnapshot(
                        requisitionId);
    }

    /*
     * =====================================================
     * SAFETY VALIDATIONS
     * =====================================================
     */

    private void assertNotAlreadyPlanned(
            MatFlowMaterialRequisition requisition) {

        boolean hasActiveReservations = reservationRepository
                .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
                        requisition.getId())
                .stream()
                .anyMatch(reservation -> reservation.status != ReservationStatus.CANCELLED
                        &&
                        reservation.status != ReservationStatus.RELEASED);

        boolean hasTransfers = !transferRepository
                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                        requisition.getId())
                .isEmpty();

        boolean hasIndents = !indentRepository
                .findByRequisition_Id(
                        requisition.getId())
                .isEmpty();

        if (hasActiveReservations ||
                hasTransfers ||
                hasIndents) {

            throw conflict(
                    "This requisition has already been reviewed by Store. " +
                            "Existing reservations, transfers or indents must be explicitly reversed before replanning.");
        }
    }

    private void assertStoreReviewable(
            MatFlowMaterialRequisition requisition) {

        String statusName = requisition.status == null
                ? ""
                : requisition.status.name();

        if (!STORE_REVIEWABLE_STATUS_NAMES.contains(
                statusName)) {

            throw conflict(
                    "Requisition cannot be reviewed by Store in status: " +
                            statusName);
        }
    }

    private boolean isStoreQueueStatus(
            RequisitionResponse response) {

        if (response == null ||
                response.status() == null) {

            return false;
        }

        return STORE_QUEUE_STATUS_NAMES.contains(
                response.status().name());
    }

    private MatFlowMaterialRequisition requireVisibleRequisition(
            UUID requisitionId,
            boolean lock) {

        if (requisitionId == null) {
            throw badRequest(
                    "Requisition ID is required");
        }

        MatFlowMaterialRequisition requisition;

        if (lock) {
            requisition = requisitionRepository
                    .lockById(
                            requisitionId)
                    .orElseThrow(() -> notFound(
                            "Requisition not found"));
        } else {
            requisition = requisitionRepository
                    .findById(
                            requisitionId)
                    .orElseThrow(() -> notFound(
                            "Requisition not found"));
        }

        if (requisition.destinationLocation == null) {
            throw conflict(
                    "Requisition has no Production destination");
        }

        if (requisition.projectDrawing == null) {
            throw conflict(
                    "Requisition has no project drawing");
        }

        accessService.requirePlantAccess(
                requisition.destinationLocation
                        .getPlantCode());

        return requisition;
    }

    /*
     * =====================================================
     * HELPERS
     * =====================================================
     */

    private boolean samePlant(
            MatFlowLocation left,
            MatFlowLocation right) {

        if (left == null ||
                right == null) {

            return false;
        }

        String leftPlant = cleanUpper(
                left.getPlantCode());

        String rightPlant = cleanUpper(
                right.getPlantCode());

        return leftPlant != null &&
                leftPlant.equals(
                        rightPlant);
    }

    private BigDecimal availableQty(
            MatFlowStockBalance balance) {

        if (balance == null) {
            return zero(
                    null);
        }

        return zero(
                balance.availableQty());
    }

    private String routeSummary(
            List<MatFlowBomRouteStep> route,
            MatFlowLocation requisitionDestination) {

        if (route == null ||
                route.isEmpty()) {

            return requisitionDestination == null
                    ? "-"
                    : requisitionDestination
                            .getLocationCode();
        }

        return route.stream()
                .filter(step -> step != null &&
                        step.location != null)
                .map(step -> step.location
                        .getLocationCode())
                .filter(code -> clean(code) != null)
                .collect(
                        Collectors.joining(
                                " → "));
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
}