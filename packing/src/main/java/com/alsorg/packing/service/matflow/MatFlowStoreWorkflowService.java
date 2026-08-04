package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreApprovedRouteStepResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineAvailabilityResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReviewRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreStockOptionResponse;

import com.alsorg.packing.domain.matflow.MatFlowBomRouteStep;
import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;

import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
     * These status names support both the current legacy workflow
     * and the newer requisition workflow while records are migrated.
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

    private static final Logger log = LoggerFactory.getLogger(
            MatFlowStoreWorkflowService.class);

    /*
     * These are the stock location types that Store may see
     * while reviewing material availability.
     *
     * Keep this synchronized with MatFlowPlanningService.
     */
    private static final Set<LocationType> AVAILABILITY_SOURCE_TYPES = EnumSet.of(
            LocationType.STORE,
            LocationType.PRODUCTION,
            LocationType.PROCESSING,
            LocationType.EXTERNAL_PROCESSOR);

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(
            3,
            RoundingMode.HALF_UP);

    private final MatFlowMaterialRequisitionRepository requisitionRepository;

    private final MatFlowRequisitionLineRepository requisitionLineRepository;

    private final MatFlowStockBalanceRepository stockRepository;

    private final MatFlowIndentRepository indentRepository;

    private final MatFlowIndentLineRepository indentLineRepository;

    private final MatFlowPlanningService planningService;

    private final MatFlowRoutingService routingService;

    private final MatFlowAccessService accessService;

    private final MatFlowAuditService auditService;

    public MatFlowStoreWorkflowService(
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowIndentRepository indentRepository,
            MatFlowIndentLineRepository indentLineRepository,
            MatFlowPlanningService planningService,
            MatFlowRoutingService routingService,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService) {

        this.requisitionRepository = requisitionRepository;

        this.requisitionLineRepository = requisitionLineRepository;

        this.stockRepository = stockRepository;

        this.indentRepository = indentRepository;

        this.indentLineRepository = indentLineRepository;

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

        /*
         * Your supplied MatFlowAccessService contains
         * requireMaterialPlanning(), not requireStore().
         *
         * ADMIN, MATFLOW_MANAGER and MATFLOW_STORE are allowed.
         */
        accessService.requireMaterialPlanning();

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
                .filter(response -> normalizedPlant == null ||
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

        accessService.requireMaterialPlanning();

        requireVisibleRequisition(
                requisitionId,
                false);

        return planningService
                .getPlanningSnapshot(
                        requisitionId);
    }

    /*
     * =====================================================
     * STORE AVAILABILITY
     * =====================================================
     */

    @Transactional(readOnly = true)
    public List<StoreLineAvailabilityResponse> getAvailability(
            UUID requisitionId) {

        accessService.requireMaterialPlanning();

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

        /*
         * =====================================================
         * HEADER AND LINE VALIDATION
         * =====================================================
         */

        if (requisition == null ||
                requisition.destinationLocation == null ||
                requisition.destinationLocation.getId() == null) {

            throw conflict(
                    "Requisition Production destination is missing");
        }

        if (line == null ||
                line.getId() == null ||
                line.material == null ||
                line.material.getId() == null ||
                line.bomLine == null ||
                line.bomLine.getId() == null) {

            throw conflict(
                    "Requisition contains an incomplete material line");
        }

        /*
         * =====================================================
         * APPROVED BOM ROUTE
         * =====================================================
         *
         * The approved BOM route is the route authority.
         *
         * Store may:
         * - select a recorded stock source;
         * - decide the reserve quantity;
         * - confirm full availability;
         * - confirm partial availability;
         * - confirm shortage.
         *
         * Store must not replace the Engineering-approved route.
         */

        List<MatFlowBomRouteStep> returnedRoute = routingService.routeForLine(
                line.bomLine.getId());

        List<MatFlowBomRouteStep> route = returnedRoute == null
                ? List.of()
                : returnedRoute.stream()
                        .filter(
                                java.util.Objects::nonNull)
                        .sorted(
                                Comparator.comparing(
                                        (
                                                MatFlowBomRouteStep step) -> step.sequenceNo,

                                        Comparator.nullsLast(
                                                Integer::compareTo)))
                        .toList();

        validateApprovedRoute(
                requisition,
                route);

        MatFlowLocation firstDestination = route.isEmpty()
                ? requisition.destinationLocation
                : route.get(0).location;

        if (firstDestination == null ||
                firstDestination.getId() == null) {

            throw conflict(
                    "Approved material route has no first destination");
        }

        /*
         * =====================================================
         * STRUCTURED ROUTE INFORMATION
         * =====================================================
         */

        List<StoreApprovedRouteStepResponse> approvedRouteSteps = route.stream()
                .map(
                        this::toStoreApprovedRouteStepResponse)
                .toList();

        /*
         * Processing is determined only by the approved BOM route.
         *
         * Store does not select an arbitrary processing location.
         */

        MatFlowBomRouteStep firstProcessingStep = route.stream()
                .filter(
                        step -> step.location != null &&
                                step.location.getId() != null &&
                                step.stepType == RouteStepType.PROCESSING)
                .findFirst()
                .orElse(null);

        boolean processingRequired = firstProcessingStep != null;

        UUID firstProcessingLocationId = firstProcessingStep == null
                ? null
                : firstProcessingStep.location
                        .getId();

        String firstProcessingLocationCode = firstProcessingStep == null
                ? null
                : firstProcessingStep.location
                        .getLocationCode();

        /*
         * =====================================================
         * NORMALIZE ALLOWED PLANTS
         * =====================================================
         *
         * The repository query should use:
         *
         * upper(location.plantCode) in :plantCodes
         *
         * Therefore all parameter values must be uppercase.
         */

        Set<String> rawAllowedPlants = accessService.allowedPlants();

        Set<String> allowedPlants = (rawAllowedPlants == null
                ? Set.<String>of()
                : rawAllowedPlants)
                .stream()
                .filter(
                        java.util.Objects::nonNull)
                .map(
                        String::trim)
                .filter(
                        value -> !value.isBlank())
                .map(
                        value -> value.toUpperCase(
                                Locale.ROOT))
                .collect(
                        Collectors.toCollection(
                                java.util.LinkedHashSet::new));

        /*
         * This validation is correct only when an empty set means
         * the user has no assigned plants.
         *
         * CurrentUserService.allowedPlants() must return all active
         * MatFlow plants for ADMIN instead of using an empty set to
         * represent unrestricted access.
         */

        if (allowedPlants.isEmpty()) {
            throw conflict(
                    "No MatFlow plants are assigned to the current user. " +
                            "Stock availability cannot be calculated.");
        }

        log.info(
                "MatFlow availability request: " +
                        "requisitionId={}, requisitionLineId={}, " +
                        "materialId={}, materialCode={}, " +
                        "allowedPlants={}, sourceTypes={}, " +
                        "firstDestination={}",
                requisition.getId(),
                line.getId(),
                line.material.getId(),
                line.material.getMaterialCode(),
                allowedPlants,
                AVAILABILITY_SOURCE_TYPES,
                firstDestination.getLocationCode());

        /*
         * =====================================================
         * LOAD STOCK CANDIDATES
         * =====================================================
         */

        List<MatFlowStockBalance> returnedBalances = stockRepository.findPlanningCandidates(
                line.material.getId(),
                allowedPlants,
                AVAILABILITY_SOURCE_TYPES);

        List<MatFlowStockBalance> balances = returnedBalances == null
                ? new ArrayList<>()
                : new ArrayList<>(
                        returnedBalances);

        log.info(
                "MatFlow availability result: materialId={}, " +
                        "materialCode={}, candidateCount={}",
                line.material.getId(),
                line.material.getMaterialCode(),
                balances.size());

        /*
         * Log the raw query result before applying defensive
         * application-level filtering.
         */

        balances.forEach(
                balance -> log.info(
                        "MatFlow stock candidate: " +
                                "balanceId={}, material={}, " +
                                "location={}, plant={}, type={}, " +
                                "active={}, supportsStock={}, " +
                                "onHand={}, reserved={}, blocked={}, " +
                                "inTransit={}, available={}",

                        balance == null
                                ? null
                                : balance.getId(),

                        balance == null ||
                                balance.material == null
                                        ? null
                                        : balance.material
                                                .getMaterialCode(),

                        balance == null ||
                                balance.location == null
                                        ? null
                                        : balance.location
                                                .getLocationCode(),

                        balance == null ||
                                balance.location == null
                                        ? null
                                        : balance.location
                                                .getPlantCode(),

                        balance == null ||
                                balance.location == null
                                        ? null
                                        : balance.location
                                                .getLocationType(),

                        balance != null &&
                                balance.location != null &&
                                balance.location.isActive(),

                        balance != null &&
                                balance.location != null &&
                                balance.location.isSupportsStock(),

                        balance == null
                                ? null
                                : balance.onHandQty,

                        balance == null
                                ? null
                                : balance.reservedQty,

                        balance == null
                                ? null
                                : balance.blockedQty,

                        balance == null
                                ? null
                                : balance.inTransitQty,

                        balance == null
                                ? null
                                : balance.availableQty()));

        /*
         * Defensive validation.
         *
         * The repository already filters active and stock-supporting
         * locations, but keeping this protects the service if the
         * repository query is changed later.
         */

        balances.removeIf(
                balance -> balance == null ||
                        balance.material == null ||
                        balance.material.getId() == null ||
                        balance.location == null ||
                        balance.location.getId() == null ||
                        !balance.location.isActive() ||
                        !balance.location.isSupportsStock());

        /*
         * =====================================================
         * SOURCE PRIORITY
         * =====================================================
         *
         * Priority:
         *
         * 1. Stock already at first approved destination.
         * 2. Stock in the same plant as first destination.
         * 3. Higher available quantity.
         * 4. Location code.
         */

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

        /*
         * Do not remove zero-available balances here.
         *
         * They may still be useful for explaining:
         * - on-hand quantity;
         * - existing reserved quantity;
         * - blocked quantity;
         * - why the free quantity is zero.
         *
         * The frontend should enable Full/Partial based on the sum
         * of option.availableQty.
         */

        List<StoreStockOptionResponse> options = balances.stream()
                .map(
                        balance -> toStockOption(
                                requisition,
                                firstDestination,
                                route,
                                balance))
                .toList();

        BigDecimal totalAvailableQty = options.stream()
                .map(
                        StoreStockOptionResponse::availableQty)
                .filter(
                        java.util.Objects::nonNull)
                .reduce(
                        ZERO,
                        BigDecimal::add)
                .setScale(
                        3,
                        RoundingMode.HALF_UP);

        log.info(
                "MatFlow availability DTO: material={}, requestedQty={}, " +
                        "optionCount={}, totalAvailableQty={}",
                line.material.getMaterialCode(),
                zero(
                        line.requestedQty),
                options.size(),
                totalAvailableQty);

        /*
         * =====================================================
         * RESPONSE
         * =====================================================
         */

        String materialCategory = clean(
                line.bomLine
                        .getMaterialCategorySnapshot());

        if (materialCategory == null) {
            materialCategory = "MISCELLANEOUS";
        }

        String approvedRouteSummary = routeSummary(
                route,
                requisition.destinationLocation);

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

                approvedRouteSummary,

                processingRequired,

                firstProcessingLocationId,

                firstProcessingLocationCode,

                approvedRouteSteps,

                options);
    }

    private StoreApprovedRouteStepResponse toStoreApprovedRouteStepResponse(
            MatFlowBomRouteStep step) {

        if (step == null ||
                step.location == null ||
                step.location.getId() == null) {

            throw conflict(
                    "Approved BOM route contains an incomplete route step");
        }

        return new StoreApprovedRouteStepResponse(
                step.getId(),
                step.sequenceNo,
                step.stepType,

                step.location.getId(),
                step.location.getLocationCode(),
                step.location.getLocationName(),
                step.location.getPlantCode(),
                step.location.getLocationType(),

                clean(
                        step.processCode));
    }

    private StoreStockOptionResponse toStockOption(
            MatFlowMaterialRequisition requisition,
            MatFlowLocation firstDestination,
            List<MatFlowBomRouteStep> route,
            MatFlowStockBalance balance) {

        if (requisition == null ||
                requisition.destinationLocation == null) {

            throw conflict(
                    "Requisition destination is missing");
        }

        if (firstDestination == null ||
                firstDestination.getId() == null) {

            throw conflict(
                    "First approved route destination is missing");
        }

        if (balance == null ||
                balance.getId() == null ||
                balance.material == null ||
                balance.location == null ||
                balance.location.getId() == null) {

            throw conflict(
                    "Stock balance is incomplete");
        }

        MatFlowLocation location = balance.location;

        BigDecimal onHandQty = zero(
                balance.onHandQty);

        BigDecimal reservedQty = zero(
                balance.reservedQty);

        BigDecimal blockedQty = zero(
                balance.blockedQty);

        /*
         * Use the entity's canonical free-stock calculation.
         *
         * Usually:
         * onHand - reserved - blocked
         */
        BigDecimal availableQty = zero(
                balance.availableQty())
                .max(
                        BigDecimal.ZERO)
                .setScale(
                        3,
                        RoundingMode.HALF_UP);

        boolean firstRouteDestination = location.getId()
                .equals(
                        firstDestination
                                .getId());

        boolean productionDestination = location.getId()
                .equals(
                        requisition.destinationLocation
                                .getId());

        /*
         * Any source other than the first approved destination
         * requires a physical transfer.
         */
        boolean transferRequired = requiresPhysicalTransfer(
                location,
                route,
                requisition.destinationLocation);

        return new StoreStockOptionResponse(
                balance.getId(),

                balance.material.getId(),
                balance.material.getMaterialCode(),
                balance.material.getMaterialName(),

                location.getId(),
                location.getLocationCode(),
                location.getLocationName(),
                location.getPlantCode(),
                location.getLocationType(),

                onHandQty,
                reservedQty,
                blockedQty,
                availableQty,

                firstRouteDestination,
                productionDestination,
                transferRequired);
    }

    /*
     * Determines whether at least one physical movement is
     * required from the selected source through the approved route.
     */
    private boolean requiresPhysicalTransfer(
            MatFlowLocation sourceLocation,
            List<MatFlowBomRouteStep> route,
            MatFlowLocation productionDestination) {

        if (sourceLocation == null ||
                sourceLocation.getId() == null ||
                productionDestination == null ||
                productionDestination.getId() == null) {

            return false;
        }

        List<MatFlowLocation> destinations = new ArrayList<>();

        if (route == null ||
                route.isEmpty()) {

            destinations.add(
                    productionDestination);

        } else {

            for (MatFlowBomRouteStep step : route) {

                if (step != null &&
                        step.location != null) {

                    destinations.add(
                            step.location);
                }
            }
        }

        MatFlowLocation current = sourceLocation;

        for (MatFlowLocation next : destinations) {

            if (next == null ||
                    next.getId() == null) {

                continue;
            }

            if (!current.getId()
                    .equals(
                            next.getId())) {

                return true;
            }

            current = next;
        }

        return false;
    }

    /*
     * =====================================================
     * CONFIRM MATERIAL-BY-MATERIAL STORE REVIEW
     * =====================================================
     */

    @Transactional
    public PlanningResponse confirmStoreReview(
            UUID requisitionId,
            StoreReviewRequest request) {

        accessService.requireMaterialPlanning();

        if (request == null) {
            throw badRequest(
                    "Store review request is required");
        }

        /*
         * Early visibility and plant-access validation.
         *
         * MatFlowPlanningService.reviewRequisition() must
         * still perform the authoritative pessimistic lock,
         * version checks, stock locks and transaction updates.
         */
        requireVisibleRequisition(
                requisitionId,
                false);

        /*
         * This replaces the old:
         *
         * planningService.planRequisition(
         * requisitionId,
         * PlanningRequest
         * );
         *
         * The new request contains one decision for every
         * requisition material line.
         */
        return planningService
                .reviewRequisition(
                        requisitionId,
                        request);
    }

    /*
     * =====================================================
     * SUBMIT SHORTAGE INDENT TO PURCHASE
     * =====================================================
     */

    @Transactional
    public void submitIndentToPurchase(
            UUID indentId,
            RequisitionActionRequest request) {

        accessService.requireMaterialPlanning();

        if (indentId == null) {
            throw badRequest(
                    "Material indent ID is required");
        }

        if (request == null) {
            throw badRequest(
                    "Indent submission request is required");
        }

        MatFlowIndent indent = indentRepository
                .lockById(
                        indentId)
                .orElseThrow(() -> notFound(
                        "Material indent not found"));

        if (indent.deliverToLocation == null) {
            throw conflict(
                    "Material indent delivery location is missing");
        }

        accessService.requirePlantAccess(
                indent.deliverToLocation
                        .getPlantCode());

        assertVersion(
                request.rowVersion(),
                indent.getRowVersion(),
                "Material indent");

        boolean allowedStatus = indent.status == IndentStatus.AUTO_CREATED ||
                indent.status == IndentStatus.DRAFT ||
                indent.status == IndentStatus.RETURNED;

        if (!allowedStatus) {
            throw conflict(
                    "Material indent cannot be submitted to Purchase in status: " +
                            indent.status);
        }

        List<MatFlowIndentLine> lines = indentLineRepository
                .findByIndent_IdOrderByCreatedAtAsc(
                        indent.getId());

        if (lines.isEmpty()) {
            throw badRequest(
                    "Material indent contains no shortage lines");
        }

        boolean invalidQuantity = lines.stream()
                .anyMatch(line -> line == null ||
                        line.requiredQty == null ||
                        line.requiredQty.compareTo(
                                BigDecimal.ZERO) <= 0);

        if (invalidQuantity) {
            throw conflict(
                    "Material indent contains an invalid required quantity");
        }

        String actor = accessService.actor();

        indent.status = IndentStatus.SUBMITTED_TO_PURCHASE;

        String remarks = clean(
                request.remarks());

        if (remarks != null) {
            indent.remarks = remarks;
        }

        indent.setUpdatedBy(
                actor);

        indent = indentRepository.saveAndFlush(
                indent);

        auditService.record(
                "INDENT",
                indent.getId(),
                "SUBMITTED_TO_PURCHASE",

                indent.deliverToLocation
                        .getPlantCode(),

                indent.projectDrawing == null
                        ? null
                        : indent.projectDrawing
                                .getProjectCode(),

                indent.projectDrawing == null
                        ? null
                        : indent.projectDrawing
                                .getDrawingNo(),

                auditService.details(
                        "indentNumber",
                        indent.indentNumber,

                        "requisitionId",
                        indent.requisition == null
                                ? null
                                : indent.requisition
                                        .getId(),

                        "requisitionNumber",
                        indent.requisition == null
                                ? null
                                : indent.requisition.requisitionNumber,

                        "lineCount",
                        lines.size(),

                        "status",
                        indent.status,

                        "remarks",
                        remarks));
    }

    /*
     * =====================================================
     * VISIBILITY AND ROUTE VALIDATION
     * =====================================================
     */

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

        if (requisition.bom == null) {
            throw conflict(
                    "Requisition has no operational BOM");
        }

        accessService.requirePlantAccess(
                requisition.destinationLocation
                        .getPlantCode());

        return requisition;
    }

    private void validateApprovedRoute(
            MatFlowMaterialRequisition requisition,
            List<MatFlowBomRouteStep> route) {

        if (requisition == null ||
                requisition.destinationLocation == null) {

            throw conflict(
                    "Requisition Production destination is missing");
        }

        if (route == null ||
                route.isEmpty()) {

            return;
        }

        for (MatFlowBomRouteStep step : route) {

            if (step == null ||
                    step.location == null) {

                throw conflict(
                        "Approved BOM route contains an incomplete step");
            }

            if (!step.location.isActive()) {
                throw conflict(
                        "Approved BOM route contains an inactive location: " +
                                step.location.getLocationCode());
            }

            accessService.requirePlantAccess(
                    step.location
                            .getPlantCode());
        }

        MatFlowBomRouteStep finalStep = route.get(
                route.size() - 1);

        if (!finalStep.location
                .getId()
                .equals(
                        requisition.destinationLocation
                                .getId())) {

            throw conflict(
                    "Approved BOM route does not end at the requisition Production destination");
        }
    }

    /*
     * =====================================================
     * HELPERS
     * =====================================================
     */

    private boolean isStoreQueueStatus(
            RequisitionResponse response) {

        if (response == null ||
                response.status() == null) {

            return false;
        }

        return STORE_QUEUE_STATUS_NAMES.contains(
                response.status().name());
    }

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
            return ZERO;
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

        String result = route.stream()
                .filter(step -> step != null &&
                        step.location != null)
                .map(step -> step.location
                        .getLocationCode())
                .filter(code -> clean(code) != null)
                .collect(
                        Collectors.joining(
                                " → "));

        return clean(result) == null
                ? "-"
                : result;
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