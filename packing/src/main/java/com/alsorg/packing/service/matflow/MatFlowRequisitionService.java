package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.PartialAvailabilityDecisionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PartialAvailabilityDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.repository.matflow.MatFlowProcessingJobRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineAvailabilityResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreLineReviewRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReviewRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreSourceAllocationRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreStockOptionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreApprovedRouteStepResponse;
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

import org.hibernate.Hibernate;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowRequisitionService {

        private static final int LINE_NUMBER_INCREMENT = 10;

        /**
         * Store planning may reserve only stock that is under Store/QC custody.
         *
         * STORE stock still has to pass the approved QC route. QC stock is already
         * inspected/accepted stock (for example accepted PO overage), so when the
         * approved first route destination is the same QC location the transfer
         * chain safely skips that already-completed QC hop. Production/Processing
         * balances are execution stock and must never be reused as fresh Store
         * planning sources.
         */
        private static final Set<LocationType> PLANNING_SOURCE_TYPES = EnumSet.of(
                        LocationType.STORE,
                        LocationType.QC);

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
        private final MatFlowBomService routingService;
        private final MatFlowAuditService auditService;

        private final ObjectMapper objectMapper;

        private final IssueModule issueModule;
        private final ControlModule controlModule;

        public MatFlowRequisitionService(
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
                        MatFlowProcessingJobRepository processingRepository,
                        MatFlowPurchaseOrderRepository purchaseOrderRepository,
                        MatFlowAccessService accessService,
                        MatFlowBomService routingService,
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

                this.issueModule = new IssueModule(
                                reservationRepository,
                                requisitionRepository,
                                requisitionLineRepository,
                                transferRepository,
                                stockRepository,
                                ledgerRepository,
                                this,
                                accessService,
                                auditService);

                this.controlModule = new ControlModule(
                                reservationRepository,
                                requisitionRepository,
                                requisitionLineRepository,
                                stockRepository,
                                ledgerRepository,
                                transferRepository,
                                processingRepository,
                                indentRepository,
                                purchaseOrderRepository,
                                this,
                                accessService,
                                indentLineRepository);
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
                requisition.partialAvailabilityDecision = PartialAvailabilityDecision.UNDECIDED;

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

                requisition.status = RequisitionStatus.SUBMITTED_TO_STORE;

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
                                "SUBMITTED_TO_STORE",
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
                        boolean deferInitialTransfer,
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
                                        ? (deferInitialTransfer ? TransferStatus.PLANNED : TransferStatus.READY)
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

        @Transactional(readOnly = true)
        public List<StoreLineAvailabilityResponse> getStoreAvailability(
                        UUID requisitionId) {

                accessService.requireMaterialPlanning();

                MatFlowMaterialRequisition requisition = requireRequisition(
                                requisitionId);

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId());

                return lines.stream()
                                .map(line -> {

                                        if (line.material == null ||
                                                        line.bomLine == null) {

                                                throw conflict(
                                                                "Requisition contains an incomplete material line");
                                        }

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

                                        List<StoreApprovedRouteStepResponse> approvedRouteSteps = route.stream()
                                                        .map(
                                                                        this::toStoreApprovedRouteStepResponse)
                                                        .toList();

                                        MatFlowBomRouteStep firstProcessingStep = route.stream()
                                                        .filter(
                                                                        step -> step != null &&
                                                                                        step.location != null &&
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

                                        MatFlowLocation firstDestination = route.isEmpty()
                                                        ? requisition.destinationLocation
                                                        : route.get(0).location;

                                        List<MatFlowStockBalance> balances = stockRepository
                                                        .findPlanningCandidates(
                                                                        line.material
                                                                                        .getId(),

                                                                        Set.of(
                                                                                        requirePlantCode(
                                                                                                        requisition.destinationLocation
                                                                                                                        .getPlantCode(),
                                                                                                        "Requisition destination")),

                                                                        PLANNING_SOURCE_TYPES);

                                        List<StoreStockOptionResponse> stockOptions = balances == null
                                                        ? List.of()
                                                        : balances.stream()
                                                                        .filter(balance -> balance != null &&
                                                                                        balance.location != null &&
                                                                                        balance.location
                                                                                                        .getId() != null)
                                                                        .map(balance -> {

                                                                                MatFlowLocation location = balance.location;

                                                                                boolean firstRouteDestination = location
                                                                                                .getId()
                                                                                                .equals(
                                                                                                                firstDestination
                                                                                                                                .getId());

                                                                                boolean productionDestination = location
                                                                                                .getId()
                                                                                                .equals(
                                                                                                                requisition.destinationLocation
                                                                                                                                .getId());

                                                                                boolean transferRequired = route
                                                                                                .isEmpty()
                                                                                                                ? !productionDestination
                                                                                                                : route.stream()
                                                                                                                                .anyMatch(step -> step.location != null
                                                                                                                                                &&
                                                                                                                                                !step.location
                                                                                                                                                                .getId()
                                                                                                                                                                .equals(
                                                                                                                                                                                location
                                                                                                                                                                                                .getId()));

                                                                                return new StoreStockOptionResponse(
                                                                                                balance.getId(),

                                                                                                line.material
                                                                                                                .getId(),

                                                                                                line.material
                                                                                                                .getMaterialCode(),

                                                                                                line.material
                                                                                                                .getMaterialName(),

                                                                                                location.getId(),
                                                                                                location.getLocationCode(),
                                                                                                location.getLocationName(),
                                                                                                location.getPlantCode(),
                                                                                                location.getLocationType(),

                                                                                                zero(
                                                                                                                balance.onHandQty),

                                                                                                zero(
                                                                                                                balance.reservedQty),

                                                                                                zero(
                                                                                                                balance.blockedQty),

                                                                                                zero(
                                                                                                                balance.availableQty()),

                                                                                                firstRouteDestination,
                                                                                                productionDestination,
                                                                                                transferRequired);
                                                                        })
                                                                        .sorted(
                                                                                        Comparator.comparing(
                                                                                                        StoreStockOptionResponse::plantCode,

                                                                                                        Comparator.nullsLast(
                                                                                                                        String.CASE_INSENSITIVE_ORDER))

                                                                                                        .thenComparing(
                                                                                                                        StoreStockOptionResponse::locationCode,

                                                                                                                        Comparator.nullsLast(
                                                                                                                                        String.CASE_INSENSITIVE_ORDER)))
                                                                        .toList();

                                        String approvedRoute = route.isEmpty()
                                                        ? requisition.destinationLocation
                                                                        .getLocationCode()
                                                        : route.stream()
                                                                        .filter(step -> step != null &&
                                                                                        step.location != null)
                                                                        .map(step -> step.location
                                                                                        .getLocationCode())
                                                                        .collect(
                                                                                        java.util.stream.Collectors
                                                                                                        .joining(
                                                                                                                        " → "));

                                        return new StoreLineAvailabilityResponse(
                                                        line.getId(),
                                                        line.lineNo,

                                                        line.material.getId(),
                                                        line.material.getMaterialCode(),
                                                        line.material.getMaterialName(),

                                                        clean(
                                                                        line.bomLine
                                                                                        .getMaterialCategorySnapshot()),

                                                        line.material.getUom(),

                                                        zero(
                                                                        line.requestedQty),

                                                        zero(
                                                                        line.reservedQty),

                                                        zero(
                                                                        line.shortageQty),

                                                        firstDestination.getId(),

                                                        firstDestination
                                                                        .getLocationCode(),

                                                        approvedRoute,

                                                        processingRequired,

                                                        firstProcessingLocationId,
                                                        firstProcessingLocationCode,

                                                        approvedRouteSteps,

                                                        stockOptions);
                                })
                                .toList();
        }

        /*
         * =====================================================
         * INDENT AND LEDGER
         * =====================================================
         */

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

        private void validateStoreRouteConfirmation(
                        StoreLineReviewRequest lineReview,
                        List<MatFlowBomRouteStep> approvedRoute,
                        MatFlowMaterial material) {

                if (lineReview == null) {
                        throw badRequest(
                                        "Store review line is required");
                }

                List<MatFlowBomRouteStep> processingSteps = approvedRoute == null
                                ? List.of()
                                : approvedRoute.stream()
                                                .filter(
                                                                step -> step != null &&
                                                                                step.location != null &&
                                                                                step.stepType == RouteStepType.PROCESSING)
                                                .toList();

                boolean approvedProcessingRequired = !processingSteps.isEmpty();

                Boolean submittedProcessingRequired = lineReview.processingRequired();

                UUID submittedProcessingLocationId = lineReview.processingLocationId();

                String materialLabel = material == null
                                ? "selected material"
                                : safeLabel(
                                                material.getMaterialCode(),
                                                material.getId());

                /*
                 * Older clients may omit the confirmation flag.
                 * When supplied, it must agree with the approved BOM.
                 */
                if (submittedProcessingRequired != null &&
                                submittedProcessingRequired != approvedProcessingRequired) {

                        throw badRequest(
                                        "Processing selection does not match the approved BOM route for material " +
                                                        materialLabel);
                }

                /*
                 * No processing location may be submitted when the
                 * approved BOM route does not require processing.
                 */
                if (!approvedProcessingRequired) {

                        if (submittedProcessingLocationId != null) {
                                throw badRequest(
                                                "A processing location was submitted for material " +
                                                                materialLabel +
                                                                ", but its approved BOM route is direct to Production");
                        }

                        return;
                }

                /*
                 * The submitted processing location, when provided,
                 * must be one of the approved processing steps.
                 */
                if (submittedProcessingLocationId != null) {

                        boolean approvedLocation = processingSteps.stream()
                                        .anyMatch(
                                                        step -> step.location
                                                                        .getId()
                                                                        .equals(
                                                                                        submittedProcessingLocationId));

                        if (!approvedLocation) {
                                throw badRequest(
                                                "Selected processing location is not part of the approved BOM route for material "
                                                                +
                                                                materialLabel);
                        }
                }
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

                /*
                 * MatFlow uses public JPA backing fields. If this entity is already
                 * present in the persistence context as a Hibernate proxy, direct field
                 * reads can bypass proxy getter interception and falsely look null.
                 * Always unwrap the aggregate root before inspecting its associations.
                 */
                requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(
                                requisition);

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

        private StoreApprovedRouteStepResponse toStoreApprovedRouteStepResponse(
                        MatFlowBomRouteStep step) {

                if (step == null ||
                                step.location == null) {

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
                                .map(rawLine -> {

                                        if (rawLine == null) {
                                                throw conflict(
                                                                "Material requisition contains an empty line");
                                        }

                                        /*
                                         * IMPORTANT:
                                         * During Store Issue, lockById(...) may already have placed a
                                         * MatFlowRequisitionLine Hibernate proxy in the current persistence
                                         * context. A later repository query can return that same managed
                                         * proxy. Because MatFlow entities expose public JPA backing fields,
                                         * reading rawLine.material / rawLine.bomLine directly from the proxy
                                         * can falsely look null even though the database foreign keys exist.
                                         *
                                         * Always unwrap the line before mapping the response. This mirrors
                                         * the defensive hydration already used by IssueModule and
                                         * toReservationResponse().
                                         */
                                        MatFlowRequisitionLine line = (MatFlowRequisitionLine) Hibernate.unproxy(
                                                        rawLine);

                                        /*
                                         * Unwrap the associations too. For normal entities this is a no-op;
                                         * for lazy Hibernate proxies it gives the mapper the authoritative
                                         * entity instance before public-field data is read.
                                         */
                                        if (line.material != null) {
                                                line.material = (MatFlowMaterial) Hibernate.unproxy(
                                                                line.material);
                                        }

                                        if (line.bomLine != null) {
                                                line.bomLine = (MatFlowBomLine) Hibernate.unproxy(
                                                                line.bomLine);
                                        }

                                        if (line.issuedMaterial != null) {
                                                line.issuedMaterial = (MatFlowMaterial) Hibernate.unproxy(
                                                                line.issuedMaterial);
                                        }

                                        if (line.material == null ||
                                                        line.bomLine == null) {

                                                throw conflict(
                                                                "Material requisition line " +
                                                                                line.getId() +
                                                                                " is incomplete " +
                                                                                "[materialMissing=" +
                                                                                (line.material == null) +
                                                                                ", bomLineMissing=" +
                                                                                (line.bomLine == null) +
                                                                                "]");
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
                                requisition.partialAvailabilityDecision,
                                requisition.partialDecisionBy,
                                requisition.partialDecisionAt,
                                requisition.partialDecisionRemarks,

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

        private boolean isReservationIssueReady(
                        MatFlowReservation reservation,
                        MatFlowLocation destination) {

                if (reservation == null ||
                                reservation.getId() == null ||
                                destination == null ||
                                destination.getId() == null) {

                        return false;
                }

                /*
                 * Do not resolve the Production destination through
                 * reservation.requisitionLine.requisition here. requisitionLine is LAZY
                 * and MatFlow entities expose public backing fields; traversing through a
                 * Hibernate proxy can therefore produce a false null even while the FK is
                 * valid. The caller already owns the authoritative requisition root and
                 * passes its Production destination explicitly.
                 */
                reservation = (MatFlowReservation) Hibernate.unproxy(
                                reservation);

                List<MatFlowTransferOrder> transfers = transferRepository
                                .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                                reservation.getId());

                if (transfers == null ||
                                transfers.isEmpty()) {

                        return reservation.sourceLocation != null &&
                                        reservation.sourceLocation
                                                        .getId()
                                                        .equals(
                                                                        destination.getId());
                }

                MatFlowTransferOrder finalTransfer = transfers.get(
                                transfers.size() - 1);

                return finalTransfer.toLocation != null &&
                                finalTransfer.toLocation
                                                .getId()
                                                .equals(
                                                                destination.getId())
                                &&
                                finalTransfer.status == TransferStatus.RECEIVED;
        }

        private boolean isPartialIssueAllowed(
                        MatFlowMaterialRequisition requisition) {
                if (requisition == null) {
                        return false;
                }

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(requisition.getId());

                boolean hasShortage = lines.stream()
                                .anyMatch(line -> zero(line.shortageQty).compareTo(BigDecimal.ZERO) > 0);

                if (!hasShortage) {
                        return true;
                }

                return requisition.partialAvailabilityDecision == PartialAvailabilityDecision.ISSUE_AVAILABLE_NOW;
        }

        private ReservationResponse toReservationResponse(
                        MatFlowReservation reservation) {

                if (reservation == null) {
                        throw conflict(
                                        "Reservation record is incomplete");
                }

                reservation = (MatFlowReservation) Hibernate.unproxy(
                                reservation);

                if (reservation.requisitionLine == null ||
                                reservation.material == null ||
                                reservation.sourceLocation == null ||
                                reservation.firstDestinationLocation == null) {

                        throw conflict(
                                        "Reservation record is incomplete");
                }

                MatFlowRequisitionLine reservationLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                reservation.requisitionLine);

                reservation.requisitionLine = reservationLine;

                if (reservationLine.requisition == null ||
                                reservationLine.requisition.getId() == null) {

                        throw conflict(
                                        "Reservation requisition link is missing");
                }

                MatFlowMaterialRequisition reservationRequisition = requireRequisition(
                                reservationLine.requisition.getId());

                MatFlowLocation issueLocation = reservationRequisition.destinationLocation;

                BigDecimal reservedQty = zero(
                                reservation.reservedQty);

                BigDecimal issuedQty = zero(
                                reservation.issuedQty);

                BigDecimal remainingIssueQty = reservedQty
                                .subtract(
                                                issuedQty)
                                .max(
                                                BigDecimal.ZERO)
                                .setScale(
                                                3,
                                                RoundingMode.HALF_UP);

                boolean issueReady = isReservationIssueReady(
                                reservation,
                                issueLocation) &&
                                isPartialIssueAllowed(
                                                reservationRequisition)
                                &&
                                remainingIssueQty.compareTo(
                                                BigDecimal.ZERO) > 0
                                &&
                                (reservation.status == ReservationStatus.ACTIVE ||
                                                reservation.status == ReservationStatus.PARTIALLY_ISSUED);

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

                                issueReady,

                                issueLocation.getId(),

                                issueLocation.getLocationCode(),

                                issueReady
                                                ? "STORE"
                                                : "TRANSFER / PROCESSING",

                                issueReady
                                                ? "ISSUE_TO_PRODUCTION"
                                                : "COMPLETE_APPROVED_ROUTE");
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

        private TransferResponse

                        toTransferResponse(
                                        MatFlowTransferOrder rawTransfer) {

                if (rawTransfer == null ||
                                rawTransfer.getId() == null) {

                        throw conflict(
                                        "Transfer order is required");
                }

                /*
                 * Planning snapshots are built in the same transaction as Store Issue.
                 * A transfer already present in the persistence context may therefore be
                 * represented by a Hibernate proxy. Because MatFlow entities expose public
                 * JPA backing fields, reading rawTransfer.requisition.projectDrawing (or
                 * other public association fields) directly from that proxy can falsely
                 * look null even though the database foreign keys are valid.
                 *
                 * Unwrap the transfer first, then resolve the authoritative requisition
                 * aggregate through requireRequisition(...). This is the same defensive
                 * hydration rule used by the Store-Issue and requisition-line response
                 * fixes and prevents a successful Issue from rolling back while the
                 * PlanningResponse is being serialized.
                 */
                MatFlowTransferOrder transfer = (MatFlowTransferOrder) Hibernate.unproxy(
                                rawTransfer);

                if (transfer.requisition == null ||
                                transfer.requisition.getId() == null) {

                        throw conflict(
                                        "Transfer requisition link is missing for transfer: " +
                                                        transfer.getId());
                }

                MatFlowMaterialRequisition requisition = requireRequisition(
                                transfer.requisition.getId());

                /*
                 * Align the managed transfer with the fully hydrated requisition so all
                 * downstream helper methods observe the same authoritative aggregate.
                 */
                transfer.requisition = requisition;

                if (transfer.reservation != null) {
                        transfer.reservation = (MatFlowReservation) Hibernate.unproxy(
                                        transfer.reservation);
                }

                if (transfer.fromLocation != null) {
                        transfer.fromLocation = (MatFlowLocation) Hibernate.unproxy(
                                        transfer.fromLocation);
                }

                if (transfer.toLocation != null) {
                        transfer.toLocation = (MatFlowLocation) Hibernate.unproxy(
                                        transfer.toLocation);
                }

                if (transfer.reservation == null ||
                                transfer.fromLocation == null ||
                                transfer.toLocation == null) {

                        throw conflict(
                                        "Transfer order " +
                                                        safeLabel(
                                                                        transfer.transferNumber,
                                                                        transfer.getId())
                                                        +
                                                        " is incomplete " +
                                                        "[reservationMissing=" +
                                                        (transfer.reservation == null) +
                                                        ", fromLocationMissing=" +
                                                        (transfer.fromLocation == null) +
                                                        ", toLocationMissing=" +
                                                        (transfer.toLocation == null) +
                                                        "]");
                }

                MatFlowTransferLine rawLine = transferLineRepository
                                .findByTransferOrder_IdOrderByCreatedAtAsc(
                                                transfer.getId())
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> conflict(
                                                "Transfer order has no material line"));

                MatFlowTransferLine line = (MatFlowTransferLine) Hibernate.unproxy(
                                rawLine);

                if (line.material != null) {
                        line.material = (MatFlowMaterial) Hibernate.unproxy(
                                        line.material);
                }

                if (line.material == null) {
                        throw conflict(
                                        "Transfer order material is missing for transfer: " +
                                                        safeLabel(
                                                                        transfer.transferNumber,
                                                                        transfer.getId()));
                }

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

                                transfer.fromLocation
                                                .getId(),

                                transfer.fromLocation
                                                .getLocationCode(),

                                transfer.fromLocation
                                                .getPlantCode(),

                                transfer.fromLocation
                                                .getLocationType(),

                                transfer.toLocation
                                                .getId(),

                                transfer.toLocation
                                                .getLocationCode(),

                                transfer.toLocation
                                                .getPlantCode(),

                                transfer.toLocation
                                                .getLocationType(),

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

        @Transactional
        public PlanningResponse reviewRequisition(
                        UUID requisitionId,
                        StoreReviewRequest request) {

                accessService.requireMaterialPlanning();

                if (requisitionId == null) {
                        throw badRequest(
                                        "Requisition ID is required");
                }

                if (request == null) {
                        throw badRequest(
                                        "Store review request is required");
                }

                requisitionRepository
                                .lockById(
                                                requisitionId)
                                .orElseThrow(() -> notFound(
                                                "Material requisition not found"));

                MatFlowMaterialRequisition requisition = requireRequisition(
                                requisitionId);

                if (!isStoreReviewableStatus(
                                requisition.status)) {

                        throw conflict(
                                        "Requisition cannot be reviewed by Store in status: " +
                                                        requisition.status);
                }

                assertVersion(
                                request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .lockByRequisitionId(
                                                requisition.getId());

                if (lines.isEmpty()) {
                        throw badRequest(
                                        "Requisition contains no material lines");
                }

                boolean existingReservation = reservationRepository
                                .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
                                                requisition.getId())
                                .stream()
                                .anyMatch(reservation -> reservation.status != ReservationStatus.CANCELLED &&
                                                reservation.status != ReservationStatus.RELEASED);

                boolean existingTransfer = transferRepository
                                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                                requisition.getId())
                                .stream()
                                .anyMatch(transfer -> transfer.status != TransferStatus.CANCELLED);

                boolean existingIndent = indentRepository
                                .findByRequisition_Id(
                                                requisition.getId())
                                .stream()
                                .anyMatch(indent -> indent.status != IndentStatus.CANCELLED);

                if (existingReservation ||
                                existingTransfer ||
                                existingIndent) {

                        throw conflict(
                                        "Store review output already exists for this requisition");
                }

                Map<UUID, StoreLineReviewRequest> reviewByLineId = new LinkedHashMap<>();

                for (StoreLineReviewRequest lineReview : request.lines()) {

                        if (lineReview == null ||
                                        lineReview.requisitionLineId() == null) {

                                throw badRequest(
                                                "Every Store review line requires a requisition line ID");
                        }

                        if (reviewByLineId.put(
                                        lineReview.requisitionLineId(),
                                        lineReview) != null) {

                                throw badRequest(
                                                "The same requisition line cannot be reviewed more than once");
                        }
                }

                Set<UUID> actualLineIds = lines.stream()
                                .map(
                                                MatFlowRequisitionLine::getId)
                                .collect(
                                                java.util.stream.Collectors.toCollection(
                                                                LinkedHashSet::new));

                if (!actualLineIds.equals(
                                reviewByLineId.keySet())) {

                        throw badRequest(
                                        "Store review must contain every requisition line exactly once");
                }

                String actor = accessService.actor();

                Map<UUID, MatFlowIndent> indentByDeliveryLocation = new LinkedHashMap<>();

                boolean hasShortage = false;

                for (MatFlowRequisitionLine line : lines) {

                        if (line == null ||
                                        line.material == null ||
                                        line.bomLine == null) {

                                throw conflict(
                                                "Requisition contains an incomplete material line");
                        }

                        StoreLineReviewRequest lineReview = reviewByLineId.get(
                                        line.getId());

                        assertVersion(
                                        lineReview.rowVersion(),
                                        line.getRowVersion(),
                                        "Requisition line");

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

                        /*
                         * Store confirms the route shown on screen.
                         * The approved BOM route remains authoritative.
                         */
                        validateStoreRouteConfirmation(
                                        lineReview,
                                        route,
                                        line.material);

                        MatFlowLocation firstDestination = route.isEmpty()
                                        ? requisition.destinationLocation
                                        : route.get(0).location;

                        if (firstDestination == null) {
                                throw conflict(
                                                "Approved material route has no first destination");
                        }

                        List<StoreSourceAllocationRequest> allocations = lineReview.allocations() == null
                                        ? List.of()
                                        : lineReview.allocations();

                        Set<UUID> usedSourceIds = new LinkedHashSet<>();

                        BigDecimal plannedAllocationTotal = allocations.stream()
                                        .filter(java.util.Objects::nonNull)
                                        .map(StoreSourceAllocationRequest::reserveQty)
                                        .filter(java.util.Objects::nonNull)
                                        .map(this::zero)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                        boolean deferInitialTransfer = plannedAllocationTotal.compareTo(BigDecimal.ZERO) > 0
                                        && plannedAllocationTotal.compareTo(requestedQty) < 0;

                        BigDecimal totalReserved = BigDecimal.ZERO.setScale(
                                        3,
                                        RoundingMode.HALF_UP);

                        for (StoreSourceAllocationRequest allocation : allocations) {

                                if (allocation == null ||
                                                allocation.sourceLocationId() == null) {

                                        throw badRequest(
                                                        "A Store allocation contains no source location");
                                }

                                if (!usedSourceIds.add(
                                                allocation.sourceLocationId())) {

                                        throw badRequest(
                                                        "The same source location cannot be allocated twice for one material");
                                }

                                BigDecimal reserveQty = positive(
                                                allocation.reserveQty(),
                                                "Reserve quantity");

                                BigDecimal nextReserved = totalReserved
                                                .add(
                                                                reserveQty)
                                                .setScale(
                                                                3,
                                                                RoundingMode.HALF_UP);

                                if (nextReserved.compareTo(
                                                requestedQty) > 0) {

                                        throw badRequest(
                                                        "Total reserved quantity cannot exceed requested quantity for material "
                                                                        +
                                                                        line.material
                                                                                        .getMaterialCode());
                                }

                                MatFlowLocation sourceLocation = requireLocation(
                                                allocation.sourceLocationId());

                                if (!sourceLocation.isSupportsStock()) {
                                        throw badRequest(
                                                        "Selected source does not support stock: " +
                                                                        sourceLocation
                                                                                        .getLocationCode());
                                }

                                if (!PLANNING_SOURCE_TYPES.contains(
                                                sourceLocation
                                                                .getLocationType())) {

                                        throw badRequest(
                                                        "Selected source is not a valid Store/QC planning location: " +
                                                                        sourceLocation
                                                                                        .getLocationCode());
                                }

                                String demandPlantCode = requirePlantCode(
                                                requisition.destinationLocation.getPlantCode(),
                                                "Requisition destination");

                                String sourcePlantCode = requirePlantCode(
                                                sourceLocation.getPlantCode(),
                                                "Store planning source " + sourceLocation.getLocationCode());

                                if (!demandPlantCode.equals(sourcePlantCode)) {
                                        throw badRequest(
                                                        "Store planning source " + sourceLocation.getLocationCode() +
                                                                        " belongs to plant " + sourcePlantCode +
                                                                        ", but the requisition belongs to "
                                                                        + demandPlantCode);
                                }

                                MatFlowStockBalance lockedBalance = stockRepository
                                                .lockBalance(
                                                                line.material
                                                                                .getId(),

                                                                sourceLocation
                                                                                .getId())
                                                .orElseThrow(() -> conflict(
                                                                "No stock balance exists for material " +
                                                                                line.material
                                                                                                .getMaterialCode()
                                                                                +
                                                                                " at location " +
                                                                                sourceLocation
                                                                                                .getLocationCode()));

                                BigDecimal availableQty = zero(
                                                lockedBalance.availableQty());

                                if (availableQty.compareTo(
                                                reserveQty) < 0) {

                                        throw conflict(
                                                        "Available stock at " +
                                                                        sourceLocation.getLocationCode() +
                                                                        " is " +
                                                                        availableQty +
                                                                        ", but Store attempted to reserve " +
                                                                        reserveQty);
                                }

                                lockedBalance.reservedQty = zero(
                                                lockedBalance.reservedQty)
                                                .add(
                                                                reserveQty)
                                                .setScale(
                                                                3,
                                                                RoundingMode.HALF_UP);

                                lockedBalance.setUpdatedBy(
                                                actor);

                                lockedBalance = stockRepository.save(
                                                lockedBalance);

                                MatFlowReservation reservation = new MatFlowReservation();

                                reservation.requisitionLine = line;

                                reservation.material = line.material;

                                reservation.sourceLocation = sourceLocation;

                                reservation.firstDestinationLocation = firstDestination;

                                reservation.demandPlantCode = requisition.destinationLocation
                                                .getPlantCode();

                                reservation.reservedQty = reserveQty;

                                reservation.issuedQty = BigDecimal.ZERO.setScale(
                                                3,
                                                RoundingMode.HALF_UP);

                                reservation.status = ReservationStatus.ACTIVE;

                                reservation.routeSnapshotJson = routeSnapshot(
                                                route);

                                reservation.setCreatedBy(
                                                actor);

                                reservation.setUpdatedBy(
                                                actor);

                                reservation = reservationRepository
                                                .saveAndFlush(
                                                                reservation);

                                saveReservationLedger(
                                                lockedBalance,
                                                requisition,
                                                reservation,
                                                reserveQty,
                                                actor);

                                createTransferChain(
                                                requisition,
                                                reservation,
                                                route,
                                                reserveQty,
                                                deferInitialTransfer,
                                                actor);

                                totalReserved = nextReserved;
                        }

                        BigDecimal shortageQty = requestedQty
                                        .subtract(
                                                        totalReserved)
                                        .max(
                                                        BigDecimal.ZERO)
                                        .setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);

                        if (shortageQty.compareTo(
                                        BigDecimal.ZERO) > 0 &&
                                        !Boolean.TRUE.equals(
                                                        lineReview.createIndentForShortage())) {

                                throw badRequest(
                                                "Material " +
                                                                line.material.getMaterialCode() +
                                                                " has an unallocated quantity of " +
                                                                shortageQty +
                                                                ". Mark the line as Partial/Shortage or reserve the complete quantity.");
                        }

                        line.reservedQty = totalReserved;

                        line.shortageQty = shortageQty;

                        line.remarks = clean(
                                        lineReview.remarks());

                        line.setUpdatedBy(
                                        actor);

                        requisitionLineRepository.save(
                                        line);

                        if (shortageQty.compareTo(
                                        BigDecimal.ZERO) > 0) {

                                hasShortage = true;

                                UUID deliveryLocationId = firstDestination.getId();

                                MatFlowIndent indent = indentByDeliveryLocation.get(
                                                deliveryLocationId);

                                if (indent == null) {
                                        indent = createIndent(
                                                        requisition,
                                                        firstDestination,
                                                        request == null
                                                                        ? null
                                                                        : request.remarks(),
                                                        actor);

                                        indentByDeliveryLocation.put(
                                                        deliveryLocationId,
                                                        indent);
                                }

                                MatFlowIndentLine indentLine = new MatFlowIndentLine();

                                indentLine.indent = indent;

                                indentLine.requisitionLine = line;

                                indentLine.material = line.material;

                                indentLine.requiredQty = shortageQty;

                                indentLine.orderedQty = BigDecimal.ZERO;

                                indentLine.receivedQty = BigDecimal.ZERO;

                                indentLine.uom = line.material.getUom();

                                indentLine.remarks = clean(
                                                lineReview.remarks());

                                if (indentLine.remarks == null) {
                                        indentLine.remarks = "Shortage confirmed during Store review";
                                }

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
                                : RequisitionStatus.PARTIALLY_RESERVED;

                requisition.plannedBy = actor;

                requisition.plannedAt = LocalDateTime.now();

                String reviewRemarks = clean(
                                request.remarks());

                if (reviewRemarks != null) {
                        requisition.remarks = reviewRemarks;
                }

                requisition.setUpdatedBy(
                                actor);

                requisition = requisitionRepository
                                .saveAndFlush(
                                                requisition);

                refreshState(
                                requisition.getId(),
                                actor);

                requisition = requisitionRepository
                                .findById(
                                                requisition.getId())
                                .orElseThrow(() -> notFound(
                                                "Requisition not found after Store review"));

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "STORE_REVIEW_CONFIRMED",

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

                                                "reviewedLineCount",
                                                lines.size(),

                                                "hasShortage",
                                                hasShortage));

                return toPlanningResponse(
                                requisition);
        }

        private MatFlowIndent createIndent(
                        MatFlowMaterialRequisition requisition,
                        MatFlowLocation deliveryLocation,
                        String remarks,
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

                indent.remarks = clean(
                                remarks);

                if (indent.remarks == null) {
                        indent.remarks = "Automatically created from Store-confirmed shortage";
                }

                indent.setCreatedBy(
                                actor);

                indent.setUpdatedBy(
                                actor);

                return indentRepository
                                .saveAndFlush(
                                                indent);
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
                                "PREVIOUS_ROUTE_STAGE";

                        case READY ->
                                departmentForLocation(
                                                transfer.fromLocation);

                        case PARTIALLY_DISPATCHED,
                                        PARTIALLY_RECEIVED ->
                                departmentForLocation(
                                                transfer.fromLocation)
                                                +
                                                " / " +
                                                departmentForLocation(
                                                                transfer.toLocation);

                        case IN_TRANSIT ->
                                departmentForLocation(
                                                transfer.toLocation);

                        case RECEIVED -> {
                                boolean hasSuccessor = transferRepository
                                                .existsByPredecessorTransferId(
                                                                transfer.getId());

                                if (hasSuccessor) {

                                        yield departmentForLocation(
                                                        transfer.toLocation);
                                }

                                LocationType destinationType = transfer.toLocation
                                                .getLocationType();

                                if (destinationType == LocationType.PRODUCTION) {

                                        yield "STORE";
                                }

                                yield departmentForLocation(
                                                transfer.toLocation);
                        }

                        case CANCELLED -> "NONE";

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
                                "AWAIT_PREDECESSOR";

                        case READY ->
                                "DISPATCH";

                        case PARTIALLY_DISPATCHED,
                                        PARTIALLY_RECEIVED ->
                                "DISPATCH_REMAINDER_OR_RECEIVE_IN_TRANSIT";

                        case IN_TRANSIT ->
                                "RECEIVE";

                        case RECEIVED -> {
                                boolean hasSuccessor = transferRepository
                                                .existsByPredecessorTransferId(
                                                                transfer.getId());

                                if (hasSuccessor) {
                                        yield "CONTINUE_APPROVED_ROUTE";
                                }

                                LocationType destinationType = transfer.toLocation
                                                .getLocationType();

                                if (destinationType == LocationType.PRODUCTION) {

                                        yield "ISSUE_TO_PRODUCTION";
                                }

                                if (destinationType == LocationType.QC) {

                                        yield "INSPECT_MATERIAL";
                                }

                                if (destinationType == LocationType.PROCESSING ||
                                                destinationType == LocationType.EXTERNAL_PROCESSOR) {

                                        yield "COMPLETE_PROCESSING";
                                }

                                yield "COMPLETED";
                        }

                        case CANCELLED ->
                                "NONE";
                };
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

        private boolean isStoreReviewableStatus(
                        RequisitionStatus status) {

                if (status == null) {
                        return false;
                }

                return switch (status.name()) {

                        case "SUBMITTED",
                                        "SUBMITTED_TO_STORE",
                                        "STORE_REVIEW_IN_PROGRESS" ->
                                true;

                        default ->
                                false;
                };
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

        /*
         * =====================================================
         * CONSOLIDATED STORE / CONTROL API
         * =====================================================
         */

        @Transactional(readOnly = true)
        public List<RequisitionResponse> listStoreQueue(String plantCode) {
                accessService.requireMaterialPlanning();

                String normalizedPlant = clean(plantCode);
                if (normalizedPlant != null) {
                        normalizedPlant = normalizedPlant.toUpperCase(Locale.ROOT);
                        accessService.requirePlantAccess(normalizedPlant);
                }

                final String plantFilter = normalizedPlant;

                return listRequisitions()
                                .stream()
                                .filter(response -> isStoreQueueStatus(response.status()))
                                .filter(response -> plantFilter == null ||
                                                plantFilter.equalsIgnoreCase(response.destinationPlantCode()))
                                .toList();
        }

        @Transactional
        public void submitIndentToPurchase(
                        UUID indentId,
                        RequisitionActionRequest request) {

                accessService.requireIndentSubmitToPurchase();

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

        @Transactional
        public PlanningResponse issueReservation(UUID reservationId, StoreIssueRequest request) {
                return issueModule.issue(reservationId, request);
        }

        @Transactional
        public RequisitionResponse decidePartialAvailability(
                        UUID requisitionId,
                        PartialAvailabilityDecisionRequest request) {
                accessService.requireProductionRequest();

                if (request == null || request.decision() == null ||
                                request.decision() == PartialAvailabilityDecision.UNDECIDED) {
                        throw badRequest(
                                        "Production must choose ISSUE_AVAILABLE_NOW or HOLD_UNTIL_SHORTAGE_COMPLETE");
                }

                MatFlowMaterialRequisition requisition = requisitionRepository
                                .lockById(requisitionId)
                                .orElseThrow(() -> notFound("Requisition not found"));

                if (requisition.destinationLocation == null) {
                        throw conflict("Requisition Production destination is missing");
                }

                accessService.requirePlantAccess(requisition.destinationLocation.getPlantCode());
                assertVersion(request.rowVersion(), requisition.getRowVersion(), "Requisition");

                if (requisition.status == RequisitionStatus.CANCELLED ||
                                requisition.status == RequisitionStatus.PRODUCTION_STARTED ||
                                requisition.status == RequisitionStatus.PRODUCTION_COMPLETED) {
                        throw conflict("Partial-availability decision cannot be changed in status: "
                                        + requisition.status);
                }

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(requisitionId);

                boolean hasShortage = lines.stream()
                                .anyMatch(line -> zero(line.shortageQty).compareTo(BigDecimal.ZERO) > 0);
                boolean hasAvailableQuantity = lines.stream()
                                .anyMatch(line -> zero(line.reservedQty).add(zero(line.issuedQty))
                                                .compareTo(BigDecimal.ZERO) > 0);

                if (!hasShortage || !hasAvailableQuantity) {
                        throw conflict(
                                        "Production partial-availability decision is only required when some quantity is available and some quantity is short");
                }

                String actor = accessService.actor();
                requisition.partialAvailabilityDecision = request.decision();
                requisition.partialDecisionBy = actor;
                requisition.partialDecisionAt = LocalDateTime.now();
                requisition.partialDecisionRemarks = clean(request.remarks());
                requisition.setUpdatedBy(actor);
                requisitionRepository.save(requisition);

                if (request.decision() == PartialAvailabilityDecision.ISSUE_AVAILABLE_NOW) {
                        activateDeferredInitialTransfers(requisition.getId(), actor);
                }

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "PARTIAL_AVAILABILITY_DECIDED",
                                requisition.destinationLocation.getPlantCode(),
                                requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber", requisition.requisitionNumber,
                                                "decision", requisition.partialAvailabilityDecision,
                                                "remarks", requisition.partialDecisionRemarks));

                refreshState(requisition.getId(), actor);

                return toRequisitionResponse(
                                requisitionRepository.findDetailById(requisition.getId())
                                                .orElseThrow(() -> notFound("Requisition not found after decision")));
        }

        @Transactional
        public ReservationResponse releaseReservation(
                        UUID reservationId,
                        ReservationReleaseRequest request) {
                ReservationResponse response = controlModule.releaseReservation(reservationId, request);

                reservationRepository.findById(reservationId).ifPresent(reservation -> {
                        if (reservation.requisitionLine != null &&
                                        reservation.requisitionLine.requisition != null) {
                                MatFlowMaterialRequisition requisition = reservation.requisitionLine.requisition;
                                auditService.record(
                                                "RESERVATION",
                                                reservationId,
                                                "RESERVATION_RELEASED",
                                                reservation.sourceLocation == null
                                                                ? null
                                                                : reservation.sourceLocation.getPlantCode(),
                                                requisition.projectDrawing == null
                                                                ? null
                                                                : requisition.projectDrawing.getProjectCode(),
                                                requisition.projectDrawing == null
                                                                ? null
                                                                : requisition.projectDrawing.getDrawingNo(),
                                                auditService.details(
                                                                "requisitionNumber", requisition.requisitionNumber,
                                                                "reason",
                                                                request == null ? null : clean(request.reason())));
                        }
                });

                return response;
        }

        @Transactional
        public RequisitionResponse cancelRequisition(
                        UUID requisitionId,
                        RequisitionCancelRequest request) {
                RequisitionResponse response = controlModule.cancelRequisition(requisitionId, request);

                MatFlowMaterialRequisition requisition = requisitionRepository
                                .findById(requisitionId)
                                .orElseThrow(() -> notFound("Requisition not found after cancellation"));

                auditService.record(
                                "REQUISITION",
                                requisitionId,
                                "REQUISITION_CANCELLED",
                                requisition.destinationLocation == null
                                                ? null
                                                : requisition.destinationLocation.getPlantCode(),
                                requisition.projectDrawing == null
                                                ? null
                                                : requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing == null
                                                ? null
                                                : requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber", requisition.requisitionNumber,
                                                "reason", request == null ? null : clean(request.reason())));

                return response;
        }

        private void activateDeferredInitialTransfers(
                        UUID requisitionId,
                        String actor) {
                transferRepository
                                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(requisitionId)
                                .stream()
                                .filter(transfer -> transfer.predecessorTransferId == null)
                                .filter(transfer -> transfer.status == TransferStatus.PLANNED)
                                .forEach(transfer -> {
                                        transfer.status = TransferStatus.READY;
                                        transfer.setUpdatedBy(actor);
                                        transferRepository.save(transfer);
                                });
        }

        /**
         * Authoritative requisition state refresh used by Store, transfer, QC
         * and Production execution. It intentionally stops using legacy
         * SUBMITTED/PLANNED/ISSUED/COMPLETED values for new workflow records.
         */
        @Transactional
        public void refreshState(UUID requisitionId, String actor) {
                MatFlowMaterialRequisition requisition = requisitionRepository
                                .lockById(requisitionId)
                                .orElseThrow(() -> notFound("Requisition not found"));

                requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(
                                requisition);

                if (requisition.status == RequisitionStatus.CANCELLED ||
                                requisition.status == RequisitionStatus.PRODUCTION_STARTED ||
                                requisition.status == RequisitionStatus.PRODUCTION_COMPLETED) {
                        return;
                }

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(requisitionId);

                if (lines.isEmpty()) {
                        return;
                }

                boolean allIssued = lines.stream()
                                .allMatch(line -> zero(line.issuedQty)
                                                .compareTo(zero(line.requestedQty)) >= 0);

                boolean anyIssued = lines.stream()
                                .anyMatch(line -> zero(line.issuedQty)
                                                .compareTo(BigDecimal.ZERO) > 0);

                boolean anyShortage = lines.stream()
                                .anyMatch(line -> zero(line.shortageQty)
                                                .compareTo(BigDecimal.ZERO) > 0);

                boolean anyReserved = lines.stream()
                                .anyMatch(line -> zero(line.reservedQty)
                                                .compareTo(BigDecimal.ZERO) > 0);

                boolean allReserved = lines.stream()
                                .allMatch(line -> zero(line.reservedQty)
                                                .add(zero(line.issuedQty))
                                                .compareTo(zero(line.requestedQty)) >= 0);

                List<MatFlowReservation> reservations = reservationRepository
                                .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(requisitionId)
                                .stream()
                                .filter(reservation -> reservation.status != ReservationStatus.CANCELLED &&
                                                reservation.status != ReservationStatus.RELEASED)
                                .toList();

                if (!anyShortage) {
                        activateDeferredInitialTransfers(
                                        requisitionId,
                                        clean(actor) == null ? accessService.actor() : actor);
                }

                /*
                 * 'requisition' is reassigned above after Hibernate.unproxy(...), so it is
                 * not effectively final and cannot be captured by the stream lambda.
                 * Capture only the destination in a final local variable.
                 */
                final MatFlowLocation productionDestination = requisition.destinationLocation;

                boolean allIssueReady = !reservations.isEmpty() &&
                                reservations.stream()
                                                .allMatch(reservation -> reservation.status == ReservationStatus.ISSUED
                                                                ||
                                                                isReservationIssueReady(
                                                                                reservation,
                                                                                productionDestination));

                RequisitionStatus nextStatus;

                if (allIssued) {
                        nextStatus = RequisitionStatus.ISSUED_TO_PRODUCTION;
                } else if (anyIssued) {
                        // Once any material has actually been issued, the requisition is
                        // operationally partially issued even if procurement shortage remains.
                        nextStatus = RequisitionStatus.PARTIALLY_ISSUED;
                } else if (anyShortage) {
                        nextStatus = RequisitionStatus.SHORTAGE_PENDING;
                } else if (allReserved && allIssueReady) {
                        nextStatus = RequisitionStatus.READY_TO_ISSUE;
                } else if (allReserved || anyReserved) {
                        nextStatus = RequisitionStatus.PARTIALLY_RESERVED;
                } else if (requisition.status == RequisitionStatus.SUBMITTED_TO_STORE ||
                                "SUBMITTED".equals(requisition.status == null ? null : requisition.status.name())) {
                        nextStatus = RequisitionStatus.STORE_REVIEW_IN_PROGRESS;
                } else {
                        return;
                }

                if (requisition.status != nextStatus) {
                        requisition.status = nextStatus;
                        requisition.setUpdatedBy(clean(actor) == null ? accessService.actor() : actor);
                        requisitionRepository.save(requisition);
                }
        }

        private boolean isStoreQueueStatus(RequisitionStatus status) {
                if (status == null) {
                        return false;
                }

                return switch (status.name()) {
                        case "SUBMITTED", "SUBMITTED_TO_STORE", "STORE_REVIEW_IN_PROGRESS",
                                        "PARTIALLY_RESERVED", "SHORTAGE_PENDING", "READY_TO_ISSUE",
                                        "PARTIALLY_ISSUED", "ISSUED_TO_PRODUCTION" ->
                                true;
                        default -> false;
                };
        }

        private static final class IssueModule {

                private final MatFlowReservationRepository reservationRepository;

                private final MatFlowMaterialRequisitionRepository requisitionRepository;

                private final MatFlowRequisitionLineRepository requisitionLineRepository;

                private final MatFlowTransferOrderRepository transferRepository;

                private final MatFlowStockBalanceRepository stockRepository;

                private final MatFlowStockLedgerRepository ledgerRepository;

                private final MatFlowRequisitionService planningService;

                private final MatFlowAccessService accessService;

                private final MatFlowAuditService auditService;

                IssueModule(
                                MatFlowReservationRepository reservationRepository,
                                MatFlowMaterialRequisitionRepository requisitionRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowRequisitionService planningService,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService) {

                        this.reservationRepository = reservationRepository;

                        this.requisitionRepository = requisitionRepository;

                        this.requisitionLineRepository = requisitionLineRepository;

                        this.transferRepository = transferRepository;

                        this.stockRepository = stockRepository;

                        this.ledgerRepository = ledgerRepository;

                        this.planningService = planningService;

                        this.accessService = accessService;

                        this.auditService = auditService;
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

                        MatFlowReservation reservation = reservationRepository
                                        .lockById(
                                                        reservationId)
                                        .orElseThrow(() -> notFound(
                                                        "Reservation not found"));

                        /*
                         * lockById can resolve to an already-managed Hibernate proxy. Unwrap
                         * before reading public association fields; otherwise a valid
                         * requisitionLine FK can appear null.
                         */
                        reservation = (MatFlowReservation) Hibernate.unproxy(
                                        reservation);

                        if (reservation.requisitionLine == null ||
                                        reservation.material == null) {

                                throw conflict(
                                                "Reservation is incomplete");
                        }

                        MatFlowRequisitionLine line = requisitionLineRepository
                                        .lockById(
                                                        reservation.requisitionLine
                                                                        .getId())
                                        .orElseThrow(() -> conflict(
                                                        "Requisition line no longer exists"));

                        /*
                         * This is the critical Store-Issue fix. The locked line itself can be
                         * a Hibernate proxy. Directly reading line.requisition from that proxy
                         * bypasses Hibernate's getter interception and can falsely produce
                         * "Reservation is not linked to a requisition" even though
                         * mf_requisition_lines.requisition_id is populated.
                         *
                         * Unwrap the line first. Once the real line entity is available, its
                         * requisition association contains the actual FK/proxy and getId() is
                         * safe. Then lock + unwrap the authoritative requisition root.
                         */
                        line = (MatFlowRequisitionLine) Hibernate.unproxy(
                                        line);

                        if (line.requisition == null ||
                                        line.requisition.getId() == null) {

                                throw conflict(
                                                "Reservation requisition link is missing for line: " +
                                                                line.getId());
                        }

                        UUID requisitionId = line.requisition.getId();

                        MatFlowMaterialRequisition lockedRequisition = requisitionRepository
                                        .lockById(
                                                        requisitionId)
                                        .orElseThrow(() -> conflict(
                                                        "Requisition no longer exists for this reservation: " +
                                                                        requisitionId));

                        MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(
                                        lockedRequisition);

                        if (requisition.destinationLocation == null) {

                                throw conflict(
                                                "Requisition Production destination is missing");
                        }

                        MatFlowLocation issueLocation = requisition.destinationLocation;

                        if (issueLocation.getLocationType() != LocationType.PRODUCTION) {
                                throw conflict(
                                                "Requisition destination is not a Production location");
                        }

                        // Keep the locked line aligned with the fully hydrated parent aggregate.
                        line.requisition = requisition;

                        accessService.requirePlantAccess(
                                        issueLocation.getPlantCode());

                        assertVersion(
                                        request.rowVersion(),
                                        reservation.getRowVersion(),
                                        "Reservation");

                        if (reservation.status != ReservationStatus.ACTIVE &&
                                        reservation.status != ReservationStatus.PARTIALLY_ISSUED) {

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

                        assertPartialAvailabilityAllowsIssue(requisition);

                        BigDecimal remaining = zero(
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

                        BigDecimal quantity = request.quantity() == null
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

                        MatFlowStockBalance productionBalance = stockRepository
                                        .lockBalance(
                                                        reservation.material
                                                                        .getId(),

                                                        issueLocation
                                                                        .getId())
                                        .orElseThrow(() -> conflict(
                                                        "Production stock balance does not exist for the reserved material"));

                        BigDecimal reservedAtProduction = zero(
                                        productionBalance.reservedQty);

                        if (reservedAtProduction.compareTo(
                                        quantity) < 0) {

                                throw conflict(
                                                "Production reserved stock is lower than the requested issue quantity");
                        }

                        productionBalance.reservedQty = reservedAtProduction
                                        .subtract(
                                                        quantity)
                                        .setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);

                        productionBalance.setUpdatedBy(
                                        accessService.actor());

                        stockRepository.save(
                                        productionBalance);

                        reservation.issuedQty = zero(
                                        reservation.issuedQty)
                                        .add(
                                                        quantity)
                                        .setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);

                        reservation.status = reservation.issuedQty
                                        .compareTo(
                                                        zero(
                                                                        reservation.reservedQty)) >= 0
                                                                                        ? ReservationStatus.ISSUED
                                                                                        : ReservationStatus.PARTIALLY_ISSUED;

                        String actor = accessService.actor();

                        reservation.setUpdatedBy(
                                        actor);

                        reservationRepository.save(
                                        reservation);

                        /*
                         * Processing may transform the BOM/raw material into a different
                         * production-issue material. The reservation is authoritative for
                         * what actually reached Production, so persist that identity on the
                         * requisition line before Production consumption begins.
                         */
                        if (line.issuedMaterial == null) {
                                line.issuedMaterial = reservation.material;
                        } else if (!line.issuedMaterial.getId()
                                        .equals(reservation.material.getId())) {
                                throw conflict(
                                                "A requisition line cannot be issued as multiple different material identities. "
                                                                +
                                                                "Existing issued material: "
                                                                + line.issuedMaterial.getMaterialCode() +
                                                                ", attempted: "
                                                                + reservation.material.getMaterialCode());
                        }

                        line.issuedQty = zero(
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

                        planningService.refreshState(
                                        requisition.getId(),
                                        actor);

                        return planningService
                                        .getPlanningSnapshot(
                                                        requisition.getId());
                }

                private void assertPartialAvailabilityAllowsIssue(
                                MatFlowMaterialRequisition requisition) {
                        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                        .findByRequisition_IdOrderByLineNoAsc(requisition.getId());

                        boolean hasShortage = lines.stream()
                                        .anyMatch(line -> zero(line.shortageQty).compareTo(BigDecimal.ZERO) > 0);

                        if (!hasShortage) {
                                return;
                        }

                        PartialAvailabilityDecision decision = requisition.partialAvailabilityDecision == null
                                        ? PartialAvailabilityDecision.UNDECIDED
                                        : requisition.partialAvailabilityDecision;

                        if (decision == PartialAvailabilityDecision.ISSUE_AVAILABLE_NOW) {
                                return;
                        }

                        if (decision == PartialAvailabilityDecision.HOLD_UNTIL_SHORTAGE_COMPLETE) {
                                throw conflict(
                                                "Production has chosen to hold available material until the shortage is completed");
                        }

                        throw conflict(
                                        "Production must decide whether to issue available material now or hold it until the shortage is completed");
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

                        List<MatFlowTransferOrder> transfers = transferRepository
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

                        MatFlowTransferOrder finalTransfer = transfers.get(
                                        transfers.size() - 1);

                        return finalTransfer.toLocation != null &&
                                        finalTransfer.toLocation
                                                        .getId()
                                                        .equals(
                                                                        productionDestination
                                                                                        .getId())
                                        &&
                                        finalTransfer.status == TransferStatus.RECEIVED;
                }

                private void saveIssueLedger(
                                MatFlowStockBalance balance,
                                MatFlowMaterialRequisition requisition,
                                MatFlowReservation reservation,
                                BigDecimal quantity,
                                StoreIssueRequest request,
                                String actor) {

                        MatFlowStockLedger ledger = new MatFlowStockLedger();

                        ledger.material = balance.material;

                        ledger.location = balance.location;

                        ledger.movementType = MovementType.ISSUE_TO_PRODUCTION;

                        /*
                         * Physical quantity remains at the Production
                         * location until Production records consumption.
                         */
                        ledger.quantityChange = BigDecimal.ZERO;

                        ledger.reservedChange = quantity.negate();

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

                        ledger.referenceType = "MATFLOW_STORE_ISSUE";

                        ledger.referenceId = reservation.getId();

                        ledger.referenceNumber = requisition.requisitionNumber;

                        ledger.projectCode = requisition.projectDrawing
                                        .getProjectCode();

                        ledger.drawingNo = requisition.projectDrawing
                                        .getDrawingNo();

                        ledger.remarks = clean(
                                        request.remarks());

                        ledger.actor = actor;

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

        private static final class ControlModule {

                private final MatFlowReservationRepository reservationRepository;
                private final MatFlowMaterialRequisitionRepository requisitionRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowStockBalanceRepository stockRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowProcessingJobRepository processingRepository;
                private final MatFlowIndentRepository indentRepository;
                private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
                private final MatFlowRequisitionService planningService;
                private final MatFlowAccessService accessService;
                private final MatFlowIndentLineRepository indentLineRepository;

                ControlModule(
                                MatFlowReservationRepository reservationRepository,
                                MatFlowMaterialRequisitionRepository requisitionRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowProcessingJobRepository processingRepository,
                                MatFlowIndentRepository indentRepository,
                                MatFlowPurchaseOrderRepository purchaseOrderRepository,
                                MatFlowRequisitionService planningService,
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

                        planningService.refreshState(
                                        requisition.getId(),
                                        actor);
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

}
