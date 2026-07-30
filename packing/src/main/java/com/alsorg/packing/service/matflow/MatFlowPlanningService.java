package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferResponse;

import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowBomLine;
import com.alsorg.packing.domain.matflow.MatFlowBomRouteStep;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowReservation;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.domain.matflow.MatFlowTransferLine;
import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;

import com.alsorg.packing.repository.matflow.MatFlowBomLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReservationRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowTransferOrderRepository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;

import java.time.LocalDate;
import java.time.LocalDateTime;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowPlanningService {

        private static final int LINE_NUMBER_INCREMENT = 10;

        private static final Set<LocationType> PLANNING_SOURCE_TYPES = EnumSet.of(
                        LocationType.STORE,
                        LocationType.PROCESSING,
                        LocationType.EXTERNAL_PROCESSOR);

        private final MatFlowMaterialRequisitionRepository requisitionRepository;
        private final MatFlowRequisitionLineRepository requisitionLineRepository;

        private final MatFlowBomRepository bomRepository;
        private final MatFlowBomLineRepository bomLineRepository;
        private final MatFlowProjectDrawingRepository projectRepository;
        private final MatFlowLocationRepository locationRepository;

        private final MatFlowStockBalanceRepository stockRepository;
        private final MatFlowStockLedgerRepository ledgerRepository;

        private final MatFlowReservationRepository reservationRepository;

        private final MatFlowIndentRepository indentRepository;
        private final MatFlowIndentLineRepository indentLineRepository;

        private final MatFlowTransferOrderRepository transferRepository;
        private final MatFlowTransferLineRepository transferLineRepository;

        private final MatFlowAccessService accessService;
        private final MatFlowRoutingService routingService;
        private final MatFlowAuditService auditService;

        private final ObjectMapper objectMapper;

        public MatFlowPlanningService(
                        MatFlowMaterialRequisitionRepository requisitionRepository,
                        MatFlowRequisitionLineRepository requisitionLineRepository,
                        MatFlowBomRepository bomRepository,
                        MatFlowBomLineRepository bomLineRepository,
                        MatFlowProjectDrawingRepository projectRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowReservationRepository reservationRepository,
                        MatFlowIndentRepository indentRepository,
                        MatFlowIndentLineRepository indentLineRepository,
                        MatFlowTransferOrderRepository transferRepository,
                        MatFlowTransferLineRepository transferLineRepository,
                        MatFlowAccessService accessService,
                        MatFlowRoutingService routingService,
                        MatFlowAuditService auditService,
                        ObjectMapper objectMapper) {

                this.requisitionRepository = requisitionRepository;
                this.requisitionLineRepository = requisitionLineRepository;

                this.bomRepository = bomRepository;
                this.bomLineRepository = bomLineRepository;
                this.projectRepository = projectRepository;
                this.locationRepository = locationRepository;

                this.stockRepository = stockRepository;
                this.ledgerRepository = ledgerRepository;

                this.reservationRepository = reservationRepository;

                this.indentRepository = indentRepository;
                this.indentLineRepository = indentLineRepository;

                this.transferRepository = transferRepository;
                this.transferLineRepository = transferLineRepository;

                this.accessService = accessService;
                this.routingService = routingService;
                this.auditService = auditService;

                this.objectMapper = objectMapper;
        }

        /*
         * =====================================================
         * REQUISITION READ
         * =====================================================
         */

        @Transactional(readOnly = true)
        public List<RequisitionResponse> listRequisitions() {

                accessService.requireRead();

                return requisitionRepository
                                .findAllByOrderByUpdatedAtDesc()
                                .stream()
                                .filter(this::canReadRequisition)
                                .map(this::toRequisitionResponse)
                                .toList();
        }

        @Transactional(readOnly = true)
        public RequisitionResponse getRequisition(
                        UUID id) {

                accessService.requireRead();

                MatFlowMaterialRequisition requisition = requireRequisition(id);

                return toRequisitionResponse(
                                requisition);
        }

        @Transactional(readOnly = true)
        public PlanningResponse getPlanningSnapshot(
                        UUID id) {

                accessService.requireRead();

                MatFlowMaterialRequisition requisition = requireRequisition(id);

                return toPlanningResponse(
                                requisition);
        }

        private PlanningResponse toPlanningResponse(
                        MatFlowMaterialRequisition requisition) {

                if (requisition == null ||
                                requisition.getId() == null) {

                        throw conflict(
                                        "Material requisition is required for planning response");
                }

                UUID requisitionId = requisition.getId();

                return new PlanningResponse(
                                toRequisitionResponse(
                                                requisition),

                                reservationRepository
                                                .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
                                                                requisitionId)
                                                .stream()
                                                .map(
                                                                this::toReservationResponse)
                                                .toList(),

                                indentRepository
                                                .findByRequisition_IdOrderByCreatedAtAsc(
                                                                requisitionId)
                                                .stream()
                                                .map(
                                                                this::toIndentResponse)
                                                .toList(),

                                transferRepository
                                                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                                                requisitionId)
                                                .stream()
                                                .map(
                                                                this::toTransferResponse)
                                                .toList());
        }

        /*
         * =====================================================
         * REQUISITION CREATE
         * =====================================================
         */

        @Transactional
        public RequisitionResponse createRequisition(
                        RequisitionCreateRequest request) {

                accessService.requireProductionRequest();

                validateCreateRequest(
                                request);

                MatFlowProjectDrawing project = projectRepository
                                .findById(
                                                request.projectDrawingId())
                                .orElseThrow(() -> notFound(
                                                "Project drawing not found"));

                if (!project.isActive()) {
                        throw badRequest(
                                        "Inactive project drawing cannot be requisitioned");
                }

                String projectPlantCode = requirePlantCode(
                                project.getPlantCode(),
                                "Project drawing " +
                                                safeLabel(
                                                                project.getProjectCode(),
                                                                project.getId()));

                accessService.requirePlantAccess(
                                projectPlantCode);

                MatFlowBom bom = bomRepository
                                .findById(
                                                request.bomId())
                                .orElseThrow(() -> notFound(
                                                "Approved operational BOM not found"));

                if (bom.getProjectDrawing() == null) {
                        throw conflict(
                                        "Selected operational BOM has no project drawing");
                }

                if (!bom.getProjectDrawing()
                                .getId()
                                .equals(
                                                project.getId())) {

                        throw badRequest(
                                        "Selected operational BOM does not belong to the selected project drawing");
                }

                String bomPlantCode = requirePlantCode(
                                bom.getProjectDrawing()
                                                .getPlantCode(),
                                "Operational BOM " +
                                                safeLabel(
                                                                bom.getBomNumber(),
                                                                bom.getId()));

                if (!projectPlantCode.equals(
                                bomPlantCode)) {

                        throw conflict(
                                        "Operational BOM plant does not match the project drawing plant");
                }

                if (bom.getStatus() != MatFlowBomStatus.APPROVED ||
                                !bom.isEffective() ||
                                !bom.isLatestRevision()) {

                        throw conflict(
                                        "Only the latest effective approved BOM can be requisitioned");
                }

                MatFlowLocation destination = requireLocation(
                                request.destinationLocationId());

                String destinationPlantCode = requirePlantCode(
                                destination.getPlantCode(),
                                "Production destination " +
                                                safeLabel(
                                                                destination.getLocationCode(),
                                                                destination.getId()));

                if (!projectPlantCode.equals(
                                destinationPlantCode)) {

                        throw badRequest(
                                        "Production destination plant " +
                                                        destinationPlantCode +
                                                        " does not match project plant " +
                                                        projectPlantCode);
                }

                if (destination.getLocationType() != LocationType.PRODUCTION) {

                        throw badRequest(
                                        "Requisition destination must be a Production location");
                }

                if (!destination.isActive()) {
                        throw badRequest(
                                        "Selected Production destination is inactive");
                }

                String actor = accessService.actor();

                MatFlowMaterialRequisition requisition = new MatFlowMaterialRequisition();

                requisition.requisitionNumber = generateNumber(
                                "MFR");

                requisition.projectDrawing = project;

                requisition.bom = bom;

                requisition.destinationLocation = destination;

                requisition.status = RequisitionStatus.DRAFT;

                requisition.requestedBy = actor;

                requisition.requestedAt = LocalDateTime.now();

                requisition.remarks = clean(
                                request.remarks());

                requisition.setCreatedBy(
                                actor);

                requisition.setUpdatedBy(
                                actor);

                requisition = requisitionRepository.save(
                                requisition);

                Set<UUID> requestBomLineIds = new LinkedHashSet<>();

                int lineNo = LINE_NUMBER_INCREMENT;

                for (RequisitionLineRequest lineRequest : request.lines()) {
                        if (lineRequest == null) {
                                throw badRequest(
                                                "Requisition line cannot be empty");
                        }

                        if (lineRequest.bomLineId() == null) {
                                throw badRequest(
                                                "BOM line is required");
                        }

                        if (!requestBomLineIds.add(
                                        lineRequest.bomLineId())) {

                                throw badRequest(
                                                "The same BOM line cannot be included more than once");
                        }

                        MatFlowBomLine bomLine = bomLineRepository
                                        .findByIdAndBom_Id(
                                                        lineRequest.bomLineId(),
                                                        bom.getId())
                                        .orElseThrow(() -> badRequest(
                                                        "BOM line does not belong to the selected operational BOM"));

                        if (bomLine.getMaterial() == null) {
                                throw conflict(
                                                "BOM line " +
                                                                bomLine.getLineNo() +
                                                                " has no linked material");
                        }

                        BigDecimal approvedQty = positive(
                                        bomLine.getNetRequiredQty(),
                                        "Approved BOM quantity");

                        BigDecimal requestedQty = positive(
                                        lineRequest.requestedQty(),
                                        "Requested quantity");

                        BigDecimal alreadyRequested = requisitionLineRepository
                                        .findByBomLine_Id(
                                                        bomLine.getId())
                                        .stream()
                                        .filter(existing -> existing != null &&
                                                        existing.requisition != null &&
                                                        existing.requisition.status != RequisitionStatus.CANCELLED)
                                        .map(existing -> zero(
                                                        existing.requestedQty))
                                        .reduce(
                                                        BigDecimal.ZERO,
                                                        BigDecimal::add);

                        if (alreadyRequested
                                        .add(
                                                        requestedQty)
                                        .compareTo(
                                                        approvedQty) > 0) {

                                throw conflict(
                                                "Requested quantity exceeds the remaining approved BOM quantity for material "
                                                                +
                                                                safeLabel(
                                                                                bomLine.getMaterialCodeSnapshot(),
                                                                                bomLine.getId()));
                        }

                        MatFlowRequisitionLine line = new MatFlowRequisitionLine();

                        line.requisition = requisition;

                        line.bomLine = bomLine;

                        line.material = bomLine.getMaterial();

                        line.lineNo = lineNo;

                        line.requestedQty = requestedQty;

                        line.reservedQty = BigDecimal.ZERO;

                        line.shortageQty = BigDecimal.ZERO;

                        line.issuedMaterial = null;

                        line.issuedQty = BigDecimal.ZERO;

                        line.consumedQty = BigDecimal.ZERO;

                        line.returnedQty = BigDecimal.ZERO;

                        line.remarks = clean(
                                        lineRequest.remarks());

                        line.setCreatedBy(
                                        actor);

                        line.setUpdatedBy(
                                        actor);

                        requisitionLineRepository.save(
                                        line);

                        lineNo += LINE_NUMBER_INCREMENT;
                }

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "CREATED",
                                projectPlantCode,
                                project.getProjectCode(),
                                project.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber",
                                                requisition.requisitionNumber,

                                                "bomId",
                                                bom.getId(),

                                                "bomNumber",
                                                bom.getBomNumber(),

                                                "bomRevisionNo",
                                                bom.getRevisionNo(),

                                                "destinationLocationId",
                                                destination.getId(),

                                                "destinationLocationCode",
                                                destination.getLocationCode(),

                                                "lineCount",
                                                requestBomLineIds.size()));

                return toRequisitionResponse(
                                requisition);
        }

        /*
         * =====================================================
         * REQUISITION SUBMIT
         * =====================================================
         */

        @Transactional
        public RequisitionResponse submitRequisition(
                        UUID id,
                        RequisitionActionRequest request) {

                accessService.requireProductionRequest();

                MatFlowMaterialRequisition requisition = requireRequisition(id);

                if (requisition.status != RequisitionStatus.DRAFT) {

                        throw conflict(
                                        "Only a Draft requisition can be submitted");
                }

                assertVersion(
                                request == null
                                                ? null
                                                : request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId());

                if (lines.isEmpty()) {
                        throw badRequest(
                                        "Requisition requires at least one material line");
                }

                String actor = accessService.actor();

                requisition.status = RequisitionStatus.SUBMITTED;

                requisition.submittedBy = actor;

                requisition.submittedAt = LocalDateTime.now();

                String actionRemarks = request == null
                                ? null
                                : clean(
                                                request.remarks());

                if (actionRemarks != null) {
                        requisition.remarks = actionRemarks;
                }

                requisition.setUpdatedBy(
                                actor);

                requisition = requisitionRepository.save(
                                requisition);

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "SUBMITTED",
                                requisition.destinationLocation
                                                .getPlantCode(),
                                requisition.projectDrawing
                                                .getProjectCode(),
                                requisition.projectDrawing
                                                .getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber",
                                                requisition.requisitionNumber,

                                                "lineCount",
                                                lines.size(),

                                                "destinationLocationCode",
                                                requisition.destinationLocation
                                                                .getLocationCode()));

                return toRequisitionResponse(
                                requisition);
        }

        /*
         * =====================================================
         * STORE PLANNING
         * =====================================================
         */

        @Transactional
        public PlanningResponse planRequisition(
                        UUID id,
                        PlanningRequest request) {

                accessService.requireMaterialPlanning();

                if (request == null) {
                        throw badRequest(
                                        "Planning request is required");
                }

                MatFlowMaterialRequisition requisition = requireRequisition(id);

                if (requisition.status != RequisitionStatus.SUBMITTED) {

                        throw conflict(
                                        "Only a Submitted requisition can be planned");
                }

                assertVersion(
                                request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                List<UUID> preferredSourceIds = normalizePreferredSources(
                                request.preferredSourceLocationIds());

                validatePreferredSources(
                                preferredSourceIds);

                Map<UUID, Integer> preferredRank = new LinkedHashMap<>();

                IntStream
                                .range(
                                                0,
                                                preferredSourceIds.size())
                                .forEach(index -> preferredRank.put(
                                                preferredSourceIds.get(
                                                                index),
                                                index));

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId());

                if (lines.isEmpty()) {
                        throw badRequest(
                                        "Requisition requires at least one material line before planning");
                }

                /*
                 * A successful plan can only happen once because the
                 * status changes away from SUBMITTED. This additional
                 * check protects legacy or partially migrated data.
                 */
                if (!reservationRepository
                                .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
                                                requisition.getId())
                                .isEmpty()) {

                        throw conflict(
                                        "Active planning records already exist for this requisition");
                }

                String actor = accessService.actor();

                Map<UUID, MatFlowIndent> indentByDeliveryLocation = new LinkedHashMap<>();

                boolean hasShortage = false;

                for (MatFlowRequisitionLine line : lines) {
                        if (line == null ||
                                        line.bomLine == null ||
                                        line.material == null) {

                                throw conflict(
                                                "Requisition contains an incomplete material line");
                        }

                        BigDecimal requestedQty = positive(
                                        line.requestedQty,
                                        "Requested quantity");

                        List<MatFlowBomRouteStep> returnedRoute = routingService.routeForLine(
                                        line.bomLine.getId());

                        List<MatFlowBomRouteStep> route = returnedRoute == null
                                        ? List.of()
                                        : returnedRoute;

                        validateRoute(
                                        route);

                        validateDestination(
                                        requisition.destinationLocation,
                                        route);

                        MatFlowLocation firstDestination = route.isEmpty()
                                        ? requisition.destinationLocation
                                        : route.get(0).location;

                        BigDecimal remaining = requestedQty;

                        List<MatFlowStockBalance> returnedCandidates = stockRepository.findPlanningCandidates(
                                        line.material.getId(),
                                        accessService.allowedPlants(),
                                        EnumSet.of(
                                                        LocationType.STORE,
                                                        LocationType.PROCESSING,
                                                        LocationType.EXTERNAL_PROCESSOR));

                        List<MatFlowStockBalance> candidates = returnedCandidates == null
                                        ? new ArrayList<>()
                                        : new ArrayList<>(
                                                        returnedCandidates);

                        /*
                         * Remove incomplete candidate records before sorting.
                         * This also prevents NullPointerException when obtaining
                         * the location ID, plant or location code.
                         */
                        candidates.removeIf(
                                        candidate -> candidate == null ||
                                                        candidate.location == null ||
                                                        candidate.location.getId() == null);

                        /*
                         * Explicitly declare the Comparator generic type.
                         *
                         * Without <MatFlowStockBalance>, Java may infer the
                         * chained lambda parameters as Object, which causes:
                         *
                         * - location cannot be resolved
                         * - samePlantRank(Object, ...) is not applicable
                         * - availableQty(Object) is not defined
                         */
                        Comparator<MatFlowStockBalance> candidateOrder = Comparator
                                        .<MatFlowStockBalance>comparingInt(
                                                        balance -> preferredRank
                                                                        .getOrDefault(
                                                                                        balance.location
                                                                                                        .getId(),
                                                                                        Integer.MAX_VALUE))
                                        .thenComparingInt(
                                                        balance -> samePlantRank(
                                                                        balance,
                                                                        firstDestination))
                                        .thenComparing(
                                                        (MatFlowStockBalance balance) -> safeAvailableQty(
                                                                        balance),

                                                        Comparator
                                                                        .<BigDecimal>reverseOrder())
                                        .thenComparing(
                                                        (MatFlowStockBalance balance) -> balance.location
                                                                        .getLocationCode(),

                                                        Comparator.nullsLast(
                                                                        String.CASE_INSENSITIVE_ORDER));

                        candidates.sort(
                                        candidateOrder);

                        BigDecimal totalReserved = BigDecimal.ZERO;

                        for (MatFlowStockBalance candidate : candidates) {
                                if (remaining.compareTo(
                                                BigDecimal.ZERO) <= 0) {

                                        break;
                                }

                                if (candidate == null ||
                                                candidate.location == null) {

                                        continue;
                                }

                                MatFlowStockBalance locked = stockRepository
                                                .lockBalance(
                                                                line.material
                                                                                .getId(),
                                                                candidate.location
                                                                                .getId())
                                                .orElse(null);

                                if (locked == null ||
                                                locked.location == null) {

                                        continue;
                                }

                                BigDecimal available = zero(
                                                locked.availableQty());

                                if (available.compareTo(
                                                BigDecimal.ZERO) <= 0) {

                                        continue;
                                }

                                BigDecimal allocated = available
                                                .min(
                                                                remaining)
                                                .setScale(
                                                                3,
                                                                RoundingMode.HALF_UP);

                                locked.reservedQty = zero(
                                                locked.reservedQty)
                                                .add(
                                                                allocated)
                                                .setScale(
                                                                3,
                                                                RoundingMode.HALF_UP);

                                locked.setUpdatedBy(
                                                actor);

                                locked = stockRepository.save(
                                                locked);

                                MatFlowReservation reservation = new MatFlowReservation();

                                reservation.requisitionLine = line;

                                reservation.material = line.material;

                                reservation.sourceLocation = locked.location;

                                reservation.firstDestinationLocation = firstDestination;

                                reservation.demandPlantCode = requisition.destinationLocation
                                                .getPlantCode();

                                reservation.reservedQty = allocated;

                                reservation.status = ReservationStatus.ACTIVE;

                                reservation.routeSnapshotJson = routeSnapshot(
                                                route);

                                reservation.setCreatedBy(
                                                actor);

                                reservation.setUpdatedBy(
                                                actor);

                                reservation = reservationRepository.save(
                                                reservation);

                                saveReservationLedger(
                                                locked,
                                                requisition,
                                                reservation,
                                                allocated,
                                                actor);

                                createTransferChain(
                                                requisition,
                                                reservation,
                                                route,
                                                allocated,
                                                actor);

                                totalReserved = totalReserved.add(
                                                allocated);

                                remaining = remaining.subtract(
                                                allocated);
                        }

                        line.reservedQty = totalReserved.setScale(
                                        3,
                                        RoundingMode.HALF_UP);

                        line.shortageQty = remaining
                                        .max(
                                                        BigDecimal.ZERO)
                                        .setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);

                        line.setUpdatedBy(
                                        actor);

                        requisitionLineRepository.save(
                                        line);

                        if (line.shortageQty.compareTo(
                                        BigDecimal.ZERO) > 0) {

                                hasShortage = true;

                                UUID deliveryLocationId = firstDestination.getId();

                                MatFlowIndent indent = indentByDeliveryLocation.get(
                                                deliveryLocationId);

                                if (indent == null) {
                                        indent = createIndent(
                                                        requisition,
                                                        firstDestination,
                                                        request,
                                                        actor);

                                        indentByDeliveryLocation.put(
                                                        deliveryLocationId,
                                                        indent);
                                }

                                MatFlowIndentLine indentLine = new MatFlowIndentLine();

                                indentLine.indent = indent;

                                indentLine.requisitionLine = line;

                                indentLine.material = line.material;

                                indentLine.requiredQty = line.shortageQty;

                                indentLine.orderedQty = BigDecimal.ZERO;

                                indentLine.receivedQty = BigDecimal.ZERO;

                                indentLine.uom = line.material.getUom();

                                indentLine.remarks = "Automatically created from requisition shortage";

                                indentLine.setCreatedBy(
                                                actor);

                                indentLine.setUpdatedBy(
                                                actor);

                                indentLineRepository.save(
                                                indentLine);
                        }
                }

                requisition.status = hasShortage
                                ? RequisitionStatus.SHORTAGE_PENDING
                                : RequisitionStatus.PLANNED;

                requisition.plannedBy = actor;

                requisition.plannedAt = LocalDateTime.now();

                String planningRemarks = clean(
                                request.remarks());

                if (planningRemarks != null) {
                        requisition.remarks = planningRemarks;
                }

                requisition.setUpdatedBy(
                                actor);

                requisition = requisitionRepository.save(
                                requisition);

                long reservedLineCount = lines.stream()
                                .filter(line -> zero(
                                                line.reservedQty)
                                                .compareTo(
                                                                BigDecimal.ZERO) > 0)
                                .count();

                long shortageLineCount = lines.stream()
                                .filter(line -> zero(
                                                line.shortageQty)
                                                .compareTo(
                                                                BigDecimal.ZERO) > 0)
                                .count();

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "PLANNED",
                                requisition.destinationLocation
                                                .getPlantCode(),
                                requisition.projectDrawing
                                                .getProjectCode(),
                                requisition.projectDrawing
                                                .getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber",
                                                requisition.requisitionNumber,

                                                "status",
                                                requisition.status,

                                                "reservedLineCount",
                                                reservedLineCount,

                                                "shortageLineCount",
                                                shortageLineCount,

                                                "preferredSourceCount",
                                                preferredSourceIds.size()));

                return toPlanningResponse(
                                requisition);
        }

        /*
         * =====================================================
         * TRANSFER CREATION
         * =====================================================
         */

        private void createTransferChain(
                        MatFlowMaterialRequisition requisition,
                        MatFlowReservation reservation,
                        List<MatFlowBomRouteStep> route,
                        BigDecimal quantity,
                        String actor) {

                if (reservation.sourceLocation == null) {
                        throw conflict(
                                        "Reservation source location is missing");
                }

                List<MatFlowLocation> destinations = new ArrayList<>();

                if (route.isEmpty()) {
                        destinations.add(
                                        requisition.destinationLocation);
                } else {
                        for (MatFlowBomRouteStep step : route) {
                                destinations.add(
                                                step.location);
                        }
                }

                MatFlowLocation current = reservation.sourceLocation;

                UUID predecessorId = null;

                int sequence = LINE_NUMBER_INCREMENT;

                for (int index = 0; index < destinations.size(); index++) {
                        MatFlowLocation next = destinations.get(
                                        index);

                        if (next == null) {
                                throw conflict(
                                                "BOM route contains a missing destination");
                        }

                        if (current.getId()
                                        .equals(
                                                        next.getId())) {

                                current = next;

                                continue;
                        }

                        MatFlowTransferOrder transfer = new MatFlowTransferOrder();

                        transfer.transferNumber = generateNumber(
                                        "MFT");

                        transfer.requisition = requisition;

                        transfer.reservation = reservation;

                        transfer.fromLocation = current;

                        transfer.toLocation = next;

                        transfer.routeSequenceNo = sequence;

                        transfer.predecessorTransferId = predecessorId;

                        transfer.purpose = determinePurpose(
                                        current,
                                        next);

                        transfer.status = predecessorId == null
                                        ? TransferStatus.READY
                                        : TransferStatus.PLANNED;

                        transfer.remarks = "Automatically planned from material requisition";

                        transfer.setCreatedBy(
                                        actor);

                        transfer.setUpdatedBy(
                                        actor);

                        transfer = transferRepository.save(
                                        transfer);

                        MatFlowTransferLine transferLine = new MatFlowTransferLine();

                        transferLine.transferOrder = transfer;

                        transferLine.material = reservation.material;

                        transferLine.routeStepId = route.isEmpty()
                                        ? null
                                        : route.get(
                                                        index)
                                                        .getId();

                        transferLine.plannedQty = quantity.setScale(
                                        3,
                                        RoundingMode.HALF_UP);

                        transferLine.dispatchedQty = BigDecimal.ZERO;

                        transferLine.receivedQty = BigDecimal.ZERO;

                        transferLine.uom = reservation.material
                                        .getUom();

                        transferLine.setCreatedBy(
                                        actor);

                        transferLine.setUpdatedBy(
                                        actor);

                        transferLineRepository.save(
                                        transferLine);

                        predecessorId = transfer.getId();

                        current = next;

                        sequence += LINE_NUMBER_INCREMENT;
                }
        }

        private TransferPurpose determinePurpose(
                        MatFlowLocation from,
                        MatFlowLocation to) {

                if (from == null ||
                                to == null) {

                        throw conflict(
                                        "Transfer source and destination are required");
                }

                String fromPlant = requirePlantCode(
                                from.getPlantCode(),
                                "Transfer source");

                String toPlant = requirePlantCode(
                                to.getPlantCode(),
                                "Transfer destination");

                if (!fromPlant.equals(
                                toPlant)) {

                        return TransferPurpose.INTER_PLANT;
                }

                LocationType fromType = from.getLocationType();

                LocationType toType = to.getLocationType();

                if (toType == LocationType.QC) {
                        return TransferPurpose.QC_TRANSFER;
                }

                boolean fromProcessing = fromType == LocationType.PROCESSING ||
                                fromType == LocationType.EXTERNAL_PROCESSOR;

                boolean toProcessing = toType == LocationType.PROCESSING ||
                                toType == LocationType.EXTERNAL_PROCESSOR;

                if (fromProcessing &&
                                toProcessing) {

                        return TransferPurpose.PROCESSING_TO_PROCESSING;
                }

                if (fromProcessing &&
                                toType == LocationType.PRODUCTION) {

                        return TransferPurpose.PROCESSING_TO_PRODUCTION;
                }

                if (toProcessing) {
                        return TransferPurpose.STORE_TO_PROCESSING;
                }

                return TransferPurpose.STORE_TO_PRODUCTION;
        }

        /*
         * =====================================================
         * INDENT AND LEDGER
         * =====================================================
         */

        private MatFlowIndent createIndent(
                        MatFlowMaterialRequisition requisition,
                        MatFlowLocation deliveryLocation,
                        PlanningRequest request,
                        String actor) {

                MatFlowIndent indent = new MatFlowIndent();

                indent.indentNumber = generateNumber(
                                "MFI");

                indent.requisition = requisition;

                indent.projectDrawing = requisition.projectDrawing;

                indent.bom = requisition.bom;

                indent.deliverToLocation = deliveryLocation;

                indent.status = IndentStatus.AUTO_CREATED;

                indent.autoGenerated = true;

                String requestedRemarks = request == null
                                ? null
                                : clean(
                                                request.remarks());

                indent.remarks = requestedRemarks == null
                                ? "Automatically created from requisition shortage"
                                : requestedRemarks;

                indent.setCreatedBy(
                                actor);

                indent.setUpdatedBy(
                                actor);

                return indentRepository.save(
                                indent);
        }

        private void saveReservationLedger(
                        MatFlowStockBalance balance,
                        MatFlowMaterialRequisition requisition,
                        MatFlowReservation reservation,
                        BigDecimal quantity,
                        String actor) {

                MatFlowStockLedger ledger = new MatFlowStockLedger();

                ledger.material = balance.material;

                ledger.location = balance.location;

                ledger.movementType = MovementType.RESERVE;

                ledger.quantityChange = BigDecimal.ZERO;

                ledger.reservedChange = quantity.setScale(
                                3,
                                RoundingMode.HALF_UP);

                ledger.blockedChange = BigDecimal.ZERO;

                ledger.inTransitChange = BigDecimal.ZERO;

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

                ledger.referenceNumber = requisition.requisitionNumber;

                ledger.projectCode = requisition.projectDrawing
                                .getProjectCode();

                ledger.drawingNo = requisition.projectDrawing
                                .getDrawingNo();

                ledger.remarks = "Reserved against material requisition";

                ledger.actor = actor;

                ledgerRepository.save(
                                ledger);
        }

        /*
         * =====================================================
         * VALIDATION
         * =====================================================
         */

        private void validateDestination(
                        MatFlowLocation requisitionDestination,
                        List<MatFlowBomRouteStep> route) {

                if (requisitionDestination == null) {
                        throw conflict(
                                        "Requisition Production destination is missing");
                }

                if (route.isEmpty()) {
                        return;
                }

                MatFlowBomRouteStep finalStep = route.get(
                                route.size() - 1);

                if (finalStep == null ||
                                finalStep.location == null) {

                        throw conflict(
                                        "Final BOM route step has no location");
                }

                if (finalStep.location
                                .getId()
                                .equals(
                                                requisitionDestination
                                                                .getId())) {

                        return;
                }

                throw conflict(
                                "Requisition Production destination does not match the final BOM route location");
        }

        private void validateRoute(
                        List<MatFlowBomRouteStep> route) {

                for (MatFlowBomRouteStep step : route) {
                        if (step == null) {
                                throw conflict(
                                                "BOM route contains an empty step");
                        }

                        if (step.location == null) {
                                throw conflict(
                                                "BOM route step " +
                                                                step.sequenceNo +
                                                                " has no location");
                        }

                        String routePlant = requirePlantCode(
                                        step.location
                                                        .getPlantCode(),
                                        "BOM route location " +
                                                        safeLabel(
                                                                        step.location
                                                                                        .getLocationCode(),
                                                                        step.location
                                                                                        .getId()));

                        accessService.requirePlantAccess(
                                        routePlant);

                        if (!step.location.isActive()) {
                                throw conflict(
                                                "BOM route contains an inactive location: " +
                                                                step.location
                                                                                .getLocationCode());
                        }
                }
        }

        private void validatePreferredSources(
                        List<UUID> locationIds) {

                for (UUID id : locationIds) {
                        MatFlowLocation location = requireLocation(
                                        id);

                        if (!location.isSupportsStock()) {
                                throw badRequest(
                                                "Preferred source does not support stock: " +
                                                                location.getLocationCode());
                        }

                        if (!PLANNING_SOURCE_TYPES.contains(
                                        location.getLocationType())) {

                                throw badRequest(
                                                "Preferred source is not a valid planning stock location: " +
                                                                location.getLocationCode());
                        }
                }
        }

        private void validateCreateRequest(
                        RequisitionCreateRequest request) {

                if (request == null) {
                        throw badRequest(
                                        "Requisition request is required");
                }

                if (request.projectDrawingId() == null) {
                        throw badRequest(
                                        "Project drawing is required");
                }

                if (request.bomId() == null) {
                        throw badRequest(
                                        "Approved operational BOM is required");
                }

                if (request.destinationLocationId() == null) {
                        throw badRequest(
                                        "Production destination is required");
                }

                if (request.lines() == null ||
                                request.lines().isEmpty()) {

                        throw badRequest(
                                        "At least one requisition line is required");
                }
        }

        /*
         * =====================================================
         * ENTITY LOADERS
         * =====================================================
         */

        private MatFlowMaterialRequisition requireRequisition(
                        UUID id) {

                if (id == null) {
                        throw badRequest(
                                        "Material requisition ID is required");
                }

                MatFlowMaterialRequisition requisition = requisitionRepository
                                .findById(id)
                                .orElseThrow(() -> notFound(
                                                "Material requisition not found"));

                if (requisition.projectDrawing == null) {
                        throw conflict(
                                        "Material requisition has no project drawing");
                }

                MatFlowProjectDrawing project = projectRepository
                                .findById(
                                                requisition.projectDrawing
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Material requisition project drawing no longer exists"));

                String projectPlantCode = requirePlantCode(
                                project.getPlantCode(),
                                "Material requisition project");

                accessService.requirePlantAccess(
                                projectPlantCode);

                if (requisition.bom == null) {
                        throw conflict(
                                        "Material requisition has no operational BOM");
                }

                MatFlowBom bom = bomRepository
                                .findById(
                                                requisition.bom
                                                                .getId())
                                .orElseThrow(() -> conflict(
                                                "Material requisition operational BOM no longer exists"));

                if (bom.getProjectDrawing() == null ||
                                !bom.getProjectDrawing()
                                                .getId()
                                                .equals(
                                                                project.getId())) {

                        throw conflict(
                                        "Material requisition BOM does not match its project drawing");
                }

                if (requisition.destinationLocation == null) {
                        throw conflict(
                                        "Material requisition has no destination location");
                }

                /*
                 * Reload through the Location repository instead of relying
                 * on direct state from a Hibernate relationship proxy.
                 */
                MatFlowLocation destination = requireLocation(
                                requisition.destinationLocation
                                                .getId());

                String destinationPlantCode = requirePlantCode(
                                destination.getPlantCode(),
                                "Material requisition destination");

                if (!projectPlantCode.equals(
                                destinationPlantCode)) {

                        throw conflict(
                                        "Material requisition destination plant " +
                                                        destinationPlantCode +
                                                        " does not match project plant " +
                                                        projectPlantCode);
                }

                if (destination.getLocationType() != LocationType.PRODUCTION) {

                        throw conflict(
                                        "Material requisition destination is not a Production location");
                }

                requisition.projectDrawing = project;

                requisition.bom = bom;

                requisition.destinationLocation = destination;

                return requisition;
        }

        private MatFlowLocation requireLocation(
                        UUID id) {

                if (id == null) {
                        throw badRequest(
                                        "Location ID is required");
                }

                MatFlowLocation location = locationRepository
                                .findById(id)
                                .orElseThrow(() -> notFound(
                                                "Location not found"));

                String locationDescription = safeLabel(
                                location.getLocationCode(),
                                location.getId());

                String plantCode = requirePlantCode(
                                location.getPlantCode(),
                                "Location " +
                                                locationDescription);

                accessService.requirePlantAccess(
                                plantCode);

                if (!location.isActive()) {
                        throw badRequest(
                                        "Inactive location cannot be selected: " +
                                                        locationDescription);
                }

                return location;
        }

        /*
         * =====================================================
         * RESPONSE MAPPERS
         * =====================================================
         */

        private RequisitionResponse toRequisitionResponse(
                        MatFlowMaterialRequisition requisition) {

                if (requisition == null) {
                        throw conflict(
                                        "Material requisition response cannot be created");
                }

                if (requisition.getId() == null) {
                        throw conflict(
                                        "Material requisition ID is missing");
                }

                if (requisition.projectDrawing == null ||
                                requisition.bom == null ||
                                requisition.destinationLocation == null) {

                        throw conflict(
                                        "Material requisition header is incomplete");
                }

                List<RequisitionLineResponse> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId())
                                .stream()
                                .map(line -> {

                                        if (line == null) {
                                                throw conflict(
                                                                "Material requisition contains an empty line");
                                        }

                                        if (line.material == null ||
                                                        line.bomLine == null) {

                                                throw conflict(
                                                                "Material requisition contains an incomplete line");
                                        }

                                        MatFlowMaterial issuedMaterial = line.issuedMaterial;

                                        String responseUom = issuedMaterial == null
                                                        ? line.material.getUom()
                                                        : issuedMaterial.getUom();

                                        /*
                                         * The category must come from the approved
                                         * BOM-line snapshot so later Material Master
                                         * edits do not change historical requisitions.
                                         */
                                        String materialCategory = clean(
                                                        line.bomLine
                                                                        .getMaterialCategorySnapshot());

                                        if (materialCategory == null) {
                                                materialCategory = "MISCELLANEOUS";
                                        }

                                        return new RequisitionLineResponse(
                                                        line.getId(),
                                                        line.lineNo,
                                                        line.bomLine.getId(),

                                                        line.material.getId(),
                                                        line.material.getMaterialCode(),
                                                        line.material.getMaterialName(),

                                                        /*
                                                         * Newly added DTO field.
                                                         */
                                                        materialCategory,

                                                        issuedMaterial == null
                                                                        ? null
                                                                        : issuedMaterial.getId(),

                                                        issuedMaterial == null
                                                                        ? null
                                                                        : issuedMaterial.getMaterialCode(),

                                                        issuedMaterial == null
                                                                        ? null
                                                                        : issuedMaterial.getMaterialName(),

                                                        responseUom,

                                                        zero(
                                                                        line.bomLine
                                                                                        .getNetRequiredQty()),

                                                        zero(
                                                                        line.requestedQty),

                                                        zero(
                                                                        line.reservedQty),

                                                        zero(
                                                                        line.shortageQty),

                                                        zero(
                                                                        line.issuedQty),

                                                        zero(
                                                                        line.consumedQty),

                                                        zero(
                                                                        line.returnedQty),

                                                        line.remarks,
                                                        line.getRowVersion());
                                })
                                .toList();

                return new RequisitionResponse(
                                requisition.getId(),
                                requisition.requisitionNumber,

                                requisition.projectDrawing
                                                .getId(),

                                requisition.projectDrawing
                                                .getProjectCode(),

                                requisition.projectDrawing
                                                .getDrawingNo(),

                                requisition.bom
                                                .getId(),

                                requisition.bom
                                                .getBomNumber(),

                                requisition.bom
                                                .getRevisionNo(),

                                requisition.destinationLocation
                                                .getId(),

                                requisition.destinationLocation
                                                .getLocationCode(),

                                requisition.destinationLocation
                                                .getLocationName(),

                                requisition.destinationLocation
                                                .getPlantCode(),

                                requisition.status,

                                requisition.requestedBy,
                                requisition.requestedAt,

                                requisition.submittedBy,
                                requisition.submittedAt,

                                requisition.plannedBy,
                                requisition.plannedAt,

                                requisition.remarks,

                                requisition.cancelledBy,
                                requisition.cancelledAt,
                                requisition.cancellationReason,

                                requisition.getRowVersion(),
                                lines);
        }

        private ReservationResponse toReservationResponse(
                        MatFlowReservation reservation) {

                if (reservation == null ||
                                reservation.requisitionLine == null ||
                                reservation.material == null ||
                                reservation.sourceLocation == null ||
                                reservation.firstDestinationLocation == null) {

                        throw conflict(
                                        "Reservation record is incomplete");
                }

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

        private IndentResponse toIndentResponse(
                        MatFlowIndent indent) {

                if (indent == null ||
                                indent.deliverToLocation == null) {

                        throw conflict(
                                        "Indent record is incomplete");
                }

                List<IndentLineResponse> lines = indentLineRepository
                                .findByIndent_IdOrderByCreatedAtAsc(
                                                indent.getId())
                                .stream()
                                .map(line -> {
                                        if (line.material == null) {
                                                throw conflict(
                                                                "Indent contains an incomplete material line");
                                        }

                                        return new IndentLineResponse(
                                                        line.getId(),

                                                        line.requisitionLine == null
                                                                        ? null
                                                                        : line.requisitionLine.getId(),

                                                        line.material.getId(),
                                                        line.material.getMaterialCode(),
                                                        line.material.getMaterialName(),

                                                        zero(line.requiredQty),
                                                        zero(line.orderedQty),
                                                        zero(line.receivedQty),

                                                        line.uom);
                                })
                                .toList();

                return new IndentResponse(
                                indent.getId(),
                                indent.indentNumber,

                                indent.deliverToLocation
                                                .getId(),

                                indent.deliverToLocation
                                                .getLocationCode(),

                                indent.deliverToLocation
                                                .getPlantCode(),

                                indent.status,
                                indent.autoGenerated,
                                indent.getRowVersion(),
                                lines);
        }

        private TransferResponse toTransferResponse(
                        MatFlowTransferOrder transfer) {

                if (transfer == null ||
                                transfer.reservation == null ||
                                transfer.fromLocation == null ||
                                transfer.toLocation == null) {

                        throw conflict(
                                        "Transfer order is incomplete");
                }

                MatFlowTransferLine line = transferLineRepository
                                .findByTransferOrder_IdOrderByCreatedAtAsc(
                                                transfer.getId())
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> conflict(
                                                "Transfer order has no material line"));

                if (line.material == null) {
                        throw conflict(
                                        "Transfer order material is missing");
                }

                return new TransferResponse(
                                transfer.getId(),
                                transfer.transferNumber,

                                transfer.reservation.getId(),

                                transfer.reservation.requisitionLine == null
                                                ? null
                                                : transfer.reservation.requisitionLine.getId(),

                                transfer.fromLocation.getId(),
                                transfer.fromLocation.getLocationCode(),
                                transfer.fromLocation.getPlantCode(),

                                transfer.toLocation.getId(),
                                transfer.toLocation.getLocationCode(),
                                transfer.toLocation.getPlantCode(),

                                transfer.routeSequenceNo,
                                transfer.predecessorTransferId,

                                transfer.purpose,
                                transfer.status,

                                line.material.getId(),
                                line.material.getMaterialCode(),
                                line.material.getMaterialName(),

                                zero(line.plannedQty),
                                zero(line.dispatchedQty),
                                zero(line.receivedQty),

                                line.uom,

                                transfer.getRowVersion());
        }

        /*
         * =====================================================
         * ROUTE SNAPSHOT
         * =====================================================
         */

        private String routeSnapshot(
                        List<MatFlowBomRouteStep> route) {

                try {
                        return objectMapper
                                        .writeValueAsString(
                                                        route.stream()
                                                                        .map(
                                                                                        this::routeStepSnapshot)
                                                                        .toList());

                } catch (JsonProcessingException ex) {
                        throw new IllegalStateException(
                                        "Unable to capture route snapshot",
                                        ex);
                }
        }

        private Map<String, Object> routeStepSnapshot(
                        MatFlowBomRouteStep step) {

                Map<String, Object> snapshot = new LinkedHashMap<>();

                snapshot.put(
                                "stepId",
                                step == null
                                                ? null
                                                : step.getId());

                snapshot.put(
                                "sequenceNo",
                                step == null
                                                ? null
                                                : step.sequenceNo);

                snapshot.put(
                                "stepType",
                                step == null
                                                ? null
                                                : step.stepType);

                snapshot.put(
                                "locationId",
                                step == null ||
                                                step.location == null
                                                                ? null
                                                                : step.location
                                                                                .getId());

                snapshot.put(
                                "locationCode",
                                step == null ||
                                                step.location == null
                                                                ? null
                                                                : step.location
                                                                                .getLocationCode());

                snapshot.put(
                                "plantCode",
                                step == null ||
                                                step.location == null
                                                                ? null
                                                                : step.location
                                                                                .getPlantCode());

                snapshot.put(
                                "processCode",
                                step == null
                                                ? null
                                                : clean(
                                                                step.processCode));

                return snapshot;
        }

        /*
         * =====================================================
         * HELPERS
         * =====================================================
         */

        private boolean canReadRequisition(
                        MatFlowMaterialRequisition requisition) {

                if (requisition == null ||
                                requisition.projectDrawing == null) {

                        return false;
                }

                String plantCode = clean(
                                requisition.projectDrawing
                                                .getPlantCode());

                return plantCode != null &&
                                accessService.canAccessPlant(
                                                plantCode);
        }

        private BigDecimal safeAvailableQty(
                        MatFlowStockBalance balance) {

                if (balance == null) {
                        return BigDecimal.ZERO
                                        .setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);
                }

                BigDecimal available = balance.availableQty();

                if (available == null) {
                        return BigDecimal.ZERO
                                        .setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);
                }

                return available.setScale(
                                3,
                                RoundingMode.HALF_UP);
        }

        private int samePlantRank(
                        MatFlowStockBalance balance,
                        MatFlowLocation destination) {

                if (balance == null ||
                                balance.location == null ||
                                destination == null) {

                        return 1;
                }

                String sourcePlant = clean(
                                balance.location
                                                .getPlantCode());

                String destinationPlant = clean(
                                destination
                                                .getPlantCode());

                if (sourcePlant == null ||
                                destinationPlant == null) {

                        return 1;
                }

                return sourcePlant.equalsIgnoreCase(
                                destinationPlant)
                                                ? 0
                                                : 1;
        }

        private List<UUID> normalizePreferredSources(
                        List<UUID> values) {

                if (values == null ||
                                values.isEmpty()) {

                        return List.of();
                }

                LinkedHashSet<UUID> unique = new LinkedHashSet<>();

                for (UUID value : values) {
                        if (value != null) {
                                unique.add(
                                                value);
                        }
                }

                return List.copyOf(
                                unique);
        }

        private String generateNumber(
                        String prefix) {

                return prefix +
                                "-" +
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

        private String requirePlantCode(
                        String value,
                        String source) {

                String normalized = clean(
                                value);

                if (normalized == null) {
                        throw conflict(
                                        source +
                                                        " does not contain a valid plant code");
                }

                return normalized.toUpperCase(
                                Locale.ROOT);
        }

        private String safeLabel(
                        String value,
                        UUID fallbackId) {

                String cleaned = clean(
                                value);

                return cleaned == null
                                ? String.valueOf(
                                                fallbackId)
                                : cleaned;
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