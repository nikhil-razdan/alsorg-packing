package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.RequisitionCancelRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.ReservationReleaseRequest;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PartialAvailabilityDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.repository.matflow.MatFlowProcessingJobRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderLineRepository;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.IndentResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ReservationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreForwardRequest;
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
import com.alsorg.packing.domain.matflow.MatFlowQcInspection;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
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
import com.alsorg.packing.repository.matflow.MatFlowQcInspectionRepository;
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
         * Store planning may reserve only stock that is physically under Store custody.
         *
         * Store decides whether the newly allocated lot needs QC.
         * Production/QC/Processing
         * balances are execution stock and must never be reused as fresh Store planning
         * sources.
         */
        private static final Set<LocationType> PLANNING_SOURCE_TYPES = EnumSet.of(LocationType.STORE);

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
        private final MatFlowProcessingJobRepository processingRepository;
        private final MatFlowPurchaseOrderLineRepository purchaseOrderLineRepository;
        private final MatFlowQcInspectionRepository qcRepository;

        private final MatFlowAccessService accessService;
        private final MatFlowBomService routingService;
        private final MatFlowAuditService auditService;
        private final MatFlowDocumentNumberService documentNumberService;
        private final MatFlowPlantRoutingService plantRoutingService;

        private final ObjectMapper objectMapper;

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
                        MatFlowPurchaseOrderLineRepository purchaseOrderLineRepository,
                        MatFlowQcInspectionRepository qcRepository,
                        MatFlowAccessService accessService,
                        MatFlowBomService routingService,
                        MatFlowAuditService auditService,
                        MatFlowDocumentNumberService documentNumberService,
                        MatFlowPlantRoutingService plantRoutingService,
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
                this.processingRepository = processingRepository;
                this.purchaseOrderLineRepository = purchaseOrderLineRepository;
                this.qcRepository = qcRepository;

                this.accessService = accessService;
                this.routingService = routingService;
                this.auditService = auditService;
                this.documentNumberService = documentNumberService;
                this.plantRoutingService = plantRoutingService;

                this.objectMapper = objectMapper;

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
                                accessService);
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

                /*
                 * A new MR is created by the Production user in the owning plant.
                 * There is no requisition entity yet, so routed Main-Store visibility
                 * cannot be evaluated here. This was the source of the compile error
                 * "requisition cannot be resolved to a variable".
                 */
                accessService.requirePlantAccess(projectPlantCode);

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

                /*
                 * Persist the Store channel for this MR so later location-master edits
                 * cannot silently change its origin/Main-Store route.
                 */
                MatFlowLocation originStore = plantRoutingService.requireOriginStore(projectPlantCode);
                MatFlowLocation mainStore = plantRoutingService.requireMainStore();

                String actor = accessService.actor();

                MatFlowMaterialRequisition requisition = new MatFlowMaterialRequisition();

                requisition.requisitionNumber = documentNumberService.nextMr();

                requisition.projectDrawing = project;

                requisition.bom = bom;

                requisition.destinationLocation = destination;
                requisition.originStore = originStore;
                requisition.mainStore = mainStore;

                requisition.status = RequisitionStatus.DRAFT;
                // Legacy column retained in the database only; the active workflow always
                // allows Store-available lots to continue while Purchase closes shortages.
                requisition.partialAvailabilityDecision = PartialAvailabilityDecision.ISSUE_AVAILABLE_NOW;

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
                accessService.requireProductionOwnership(requisition.requestedBy);

                if (requisition.status != RequisitionStatus.DRAFT) {
                        throw conflict("Only a Draft requisition can be submitted");
                }

                assertVersion(
                                request == null ? null : request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(requisition.getId());
                if (lines.isEmpty()) {
                        throw badRequest("Requisition requires at least one material line");
                }

                String originPlant = plantRoutingService.normalizeFactoryPlant(
                                requisition.destinationLocation.getPlantCode());
                MatFlowLocation originStore = requisition.originStore == null
                                ? plantRoutingService.requireOriginStore(originPlant)
                                : requisition.originStore;
                MatFlowLocation mainStore = requisition.mainStore == null
                                ? plantRoutingService.requireMainStore()
                                : requisition.mainStore;
                plantRoutingService.assertOriginStoreLocation(originStore, originPlant, "MR origin Store");
                plantRoutingService.assertMainStoreLocation(mainStore, "MR Main Store");
                requisition.originStore = originStore;
                requisition.mainStore = mainStore;
                String actor = accessService.actor();

                /*
                 * AL-P1 Production reaches Main Store directly. AL-P2/3/4 remain in
                 * SUBMITTED_TO_STORE until their own Store forwards this exact MR.
                 */
                boolean directToMainStore = plantRoutingService.isMainStorePlant(originPlant);
                requisition.status = directToMainStore
                                ? RequisitionStatus.STORE_REVIEW_IN_PROGRESS
                                : RequisitionStatus.SUBMITTED_TO_STORE;
                requisition.submittedBy = actor;
                requisition.submittedAt = LocalDateTime.now();

                String actionRemarks = request == null ? null : clean(request.remarks());
                if (actionRemarks != null) {
                        requisition.remarks = actionRemarks;
                }
                requisition.setUpdatedBy(actor);
                requisition = requisitionRepository.save(requisition);

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                directToMainStore
                                                ? "SUBMITTED_DIRECT_TO_MAIN_STORE"
                                                : "SUBMITTED_TO_ORIGIN_PLANT_STORE",
                                originPlant,
                                requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber", requisition.requisitionNumber,
                                                "lineCount", lines.size(),
                                                "originPlant", originPlant,
                                                "originStoreId", originStore.getId(),
                                                "originStoreCode", originStore.getLocationCode(),
                                                "mainStoreId", mainStore.getId(),
                                                "mainStoreCode", mainStore.getLocationCode(),
                                                "requestedBy", requisition.requestedBy,
                                                "routingState", directToMainStore
                                                                ? "AT_MAIN_STORE"
                                                                : "AWAITING_ORIGIN_STORE_FORWARD"));

                return toRequisitionResponse(requisition);
        }

        /**
         * AL-P2/3/4 Plant Store forwards the existing MR unchanged to AL-P1 Main
         * Store. No second MR and no quantity mutation is created. Actor/time are
         * retained in the immutable audit stream. AL-P1 never uses this hop.
         */
        @Transactional
        public RequisitionResponse forwardRequisitionToMainStore(
                        UUID requisitionId,
                        StoreForwardRequest request) {
                if (requisitionId == null) {
                        throw badRequest("Requisition ID is required");
                }
                if (request == null) {
                        throw badRequest("Store forwarding request is required");
                }

                requisitionRepository.lockById(requisitionId)
                                .orElseThrow(() -> notFound("Material requisition not found"));

                MatFlowMaterialRequisition requisition = requireRequisitionForRouting(requisitionId);
                String originPlant = plantRoutingService.normalizeFactoryPlant(
                                requisition.destinationLocation.getPlantCode());

                if (plantRoutingService.isMainStorePlant(originPlant)) {
                        throw conflict("AL-P1 Production requisitions already route directly to AL-P1 Main Store");
                }
                plantRoutingService.requireOriginStoreActor(originPlant);
                if (requisition.status != RequisitionStatus.SUBMITTED_TO_STORE) {
                        throw conflict("Only an MR waiting at its origin Plant Store can be forwarded. Current status: "
                                        + requisition.status);
                }
                assertVersion(request.rowVersion(), requisition.getRowVersion(), "Requisition");

                MatFlowLocation originStore = requisition.originStore == null
                                ? plantRoutingService.requireOriginStore(originPlant)
                                : requisition.originStore;
                MatFlowLocation mainStore = requisition.mainStore == null
                                ? plantRoutingService.requireMainStore()
                                : requisition.mainStore;
                plantRoutingService.assertOriginStoreLocation(originStore, originPlant, "MR forwarding origin Store");
                plantRoutingService.assertMainStoreLocation(mainStore, "MR forwarding Main Store");
                String actor = accessService.actor();

                requisition.originStore = originStore;
                requisition.mainStore = mainStore;
                requisition.status = RequisitionStatus.STORE_REVIEW_IN_PROGRESS;
                requisition.forwardedToMainStoreBy = actor;
                requisition.forwardedToMainStoreAt = LocalDateTime.now();
                String forwardingRemarks = clean(request.remarks());
                requisition.forwardingRemarks = forwardingRemarks;
                if (forwardingRemarks != null) {
                        requisition.remarks = forwardingRemarks;
                }
                requisition.setUpdatedBy(actor);
                requisition = requisitionRepository.saveAndFlush(requisition);

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "REQUISITION_FORWARDED_TO_MAIN_STORE",
                                originPlant,
                                requisition.projectDrawing == null ? null
                                                : requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing == null ? null
                                                : requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber", requisition.requisitionNumber,
                                                "originPlant", originPlant,
                                                "fromStoreId", originStore.getId(),
                                                "fromStoreCode", originStore.getLocationCode(),
                                                "toStoreId", mainStore.getId(),
                                                "toStoreCode", mainStore.getLocationCode(),
                                                "productionUser", requisition.requestedBy,
                                                "forwardedBy", actor,
                                                "remarks", forwardingRemarks));

                return toRequisitionResponse(requisition);
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

        /**
         * Creates the hidden custody chain selected by Store for one reservation lot.
         *
         * QC is not a location and is not a route owner. If QC is required, only the
         * first physical hand-off is deferred until the QC tick is completed.
         *
         * Route shapes:
         * no Processing: Store -> Production
         * Processing: Store -> Processing -> Production
         */
        private void createTransferChain(
                        MatFlowMaterialRequisition requisition,
                        MatFlowReservation reservation,
                        MatFlowBomRouteStep selectedProcessingStep,
                        BigDecimal quantity,
                        boolean qcRequired,
                        String actor) {
                if (reservation == null || reservation.sourceLocation == null) {
                        throw conflict("Reservation source location is missing");
                }
                if (requisition == null || requisition.destinationLocation == null) {
                        throw conflict("MR Production destination is missing");
                }

                MatFlowLocation mainStore = requisition.mainStore == null
                                ? plantRoutingService.requireMainStore()
                                : requisition.mainStore;
                plantRoutingService.assertMainStoreLocation(
                                mainStore,
                                "MR persisted Main Store");
                plantRoutingService.assertMainStoreLocation(
                                reservation.sourceLocation,
                                "MR reservation source");
                if (!mainStore.getId().equals(reservation.sourceLocation.getId())) {
                        throw conflict("MR reservation source is not the configured AL-P1 Main Store");
                }

                MatFlowLocation production = requisition.destinationLocation;
                String originPlant = plantRoutingService.normalizeFactoryPlant(production.getPlantCode());
                MatFlowLocation originStore = requisition.originStore == null
                                ? plantRoutingService.requireOriginStore(originPlant)
                                : requisition.originStore;
                plantRoutingService.assertOriginStoreLocation(originStore, originPlant, "MR persisted origin Store");
                boolean remotePlant = plantRoutingService.requiresOriginStoreHop(originPlant);

                MatFlowTransferOrder predecessor = null;
                int sequence = LINE_NUMBER_INCREMENT;

                if (selectedProcessingStep != null) {
                        MatFlowLocation processingLocation = selectedProcessingStep.location;
                        if (processingLocation == null) {
                                throw conflict("Selected Processing option has no location");
                        }

                        predecessor = createPlannedTransfer(
                                        requisition, reservation, mainStore, processingLocation,
                                        selectedProcessingStep.getId(), null, sequence, quantity, qcRequired,
                                        qcRequired
                                                        ? "Main Store lot is reserved; waiting for QC tick before Processing"
                                                        : "Main Store lot is ready for the selected Processing Unit",
                                        actor);
                        sequence += LINE_NUMBER_INCREMENT;

                        /* Processing output returns to Main Store before plant issue. */
                        predecessor = createPlannedTransfer(
                                        requisition, reservation, processingLocation, mainStore,
                                        null, predecessor.getId(), sequence, quantity, true,
                                        "Processing output returns to AL-P1 Main Store for plant issue", actor);
                        sequence += LINE_NUMBER_INCREMENT;
                }

                if (remotePlant) {
                        predecessor = createPlannedTransfer(
                                        requisition, reservation, mainStore, originStore, null,
                                        predecessor == null ? null : predecessor.getId(),
                                        sequence, quantity,
                                        predecessor != null || qcRequired,
                                        predecessor != null
                                                        ? "Ready lot awaits AL-P1 Main Store release to the originating Plant Store"
                                                        : qcRequired
                                                                        ? "Main Store lot waits for QC before inter-plant issue"
                                                                        : "Main Store lot is ready for inter-plant issue to the originating Plant Store",
                                        actor);
                        sequence += LINE_NUMBER_INCREMENT;

                        createPlannedTransfer(
                                        requisition, reservation, originStore, production, null,
                                        predecessor.getId(), sequence, quantity, true,
                                        "Origin Plant Store will hand the complete lot to the specific Production user",
                                        actor);
                } else {
                        createPlannedTransfer(
                                        requisition, reservation, mainStore, production, null,
                                        predecessor == null ? null : predecessor.getId(),
                                        sequence, quantity,
                                        predecessor != null || qcRequired,
                                        predecessor != null
                                                        ? "Ready lot awaits AL-P1 Main Store release to Production"
                                                        : qcRequired
                                                                        ? "Main Store lot waits for QC before Production issue"
                                                                        : "Main Store lot is ready for direct AL-P1 Production issue",
                                        actor);
                }
        }

        /**
         * Creates a QC check record without moving the material to a QC location.
         * The legacy inspection entity is retained as durable audit storage; its
         * location points to the Store source only for schema/plant-access
         * compatibility and is never exposed as a QC location.
         */
        private void createQcCheck(
                        MatFlowMaterialRequisition requisition,
                        MatFlowReservation reservation,
                        BigDecimal quantity,
                        String actor) {
                if (reservation == null || reservation.getId() == null) {
                        throw conflict("Reservation is required before creating QC check");
                }

                boolean existing = qcRepository
                                .findBySourceTypeAndSourceLineId(
                                                QcSourceType.TRANSFER_RECEIPT,
                                                reservation.getId())
                                .isPresent();
                if (existing) {
                        return;
                }

                MatFlowQcInspection check = new MatFlowQcInspection();
                check.inspectionNumber = "QC_INTERNAL_" + reservation.getId();
                check.sourceType = QcSourceType.TRANSFER_RECEIPT;
                check.sourceId = reservation.getId();
                check.sourceLineId = reservation.getId();
                check.routingReservationId = reservation.getId();
                check.material = reservation.material;
                check.location = reservation.sourceLocation;
                check.inspectionQty = zero(quantity);
                check.acceptedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                check.rejectedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                check.status = QcInspectionStatus.PENDING;
                check.remarks = "QC check requested by Store against " + requisition.requisitionNumber;
                check.setCreatedBy(actor);
                check.setUpdatedBy(actor);
                check = qcRepository.save(check);

                auditService.record(
                                "QC_CHECK",
                                check.getId(),
                                "QC_CHECK_REQUESTED",
                                reservation.sourceLocation.getPlantCode(),
                                requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber", requisition.requisitionNumber,
                                                "reservationId", reservation.getId(),
                                                "materialCode", reservation.material == null
                                                                ? null
                                                                : reservation.material.getMaterialCode(),
                                                "quantity", quantity,
                                                "processingRequired",
                                                reservation.firstDestinationLocation != null
                                                                && (reservation.firstDestinationLocation
                                                                                .getLocationType() == LocationType.PROCESSING
                                                                                || reservation.firstDestinationLocation
                                                                                                .getLocationType() == LocationType.EXTERNAL_PROCESSOR)));
        }

        private MatFlowTransferOrder createPlannedTransfer(
                        MatFlowMaterialRequisition requisition,
                        MatFlowReservation reservation,
                        MatFlowLocation from,
                        MatFlowLocation to,
                        UUID routeStepId,
                        UUID predecessorId,
                        int sequence,
                        BigDecimal quantity,
                        boolean defer,
                        String remarks,
                        String actor) {

                if (from == null || to == null) {
                        throw conflict("Transfer source and destination are required");
                }

                MatFlowTransferOrder transfer = new MatFlowTransferOrder();
                transfer.transferNumber = generateNumber("MFT");
                transfer.requisition = requisition;
                transfer.reservation = reservation;
                transfer.fromLocation = from;
                transfer.toLocation = to;
                transfer.routeSequenceNo = sequence;
                transfer.predecessorTransferId = predecessorId;
                transfer.purpose = determinePurpose(from, to);
                transfer.status = predecessorId == null && !defer
                                ? TransferStatus.READY
                                : TransferStatus.PLANNED;
                transfer.remarks = remarks;
                transfer.setCreatedBy(actor);
                transfer.setUpdatedBy(actor);
                transfer = transferRepository.save(transfer);

                MatFlowTransferLine transferLine = new MatFlowTransferLine();
                transferLine.transferOrder = transfer;
                transferLine.material = reservation.material;
                transferLine.routeStepId = routeStepId;
                transferLine.plannedQty = quantity.setScale(3, RoundingMode.HALF_UP);
                transferLine.dispatchedQty = BigDecimal.ZERO;
                transferLine.receivedQty = BigDecimal.ZERO;
                transferLine.uom = reservation.material.getUom();
                transferLine.setCreatedBy(actor);
                transferLine.setUpdatedBy(actor);
                transferLineRepository.save(transferLine);

                return transfer;
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

                if (fromType == LocationType.QC &&
                                (toType == LocationType.PROCESSING ||
                                                toType == LocationType.EXTERNAL_PROCESSOR)) {
                        return TransferPurpose.QC_TO_PROCESSING;
                }

                if (fromType == LocationType.QC &&
                                toType == LocationType.PRODUCTION) {
                        return TransferPurpose.QC_TO_PRODUCTION;
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
                plantRoutingService.requireMainStorePlanningActor();
                MatFlowMaterialRequisition requisition = requireRequisitionForMainStore(requisitionId);
                requireAtMainStore(requisition);
                MatFlowLocation mainStore = requisition.mainStore == null
                                ? plantRoutingService.requireMainStore()
                                : requisition.mainStore;
                plantRoutingService.assertMainStoreLocation(mainStore, "MR availability Main Store");

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(requisition.getId());

                return lines.stream().map(line -> {
                        if (line.material == null || line.bomLine == null) {
                                throw conflict("Requisition contains an incomplete material line");
                        }

                        List<MatFlowBomRouteStep> processingOptions = routingService.routeForLine(line.bomLine.getId());
                        processingOptions = processingOptions == null ? List.of() : processingOptions;
                        validateRoute(processingOptions);

                        List<StoreApprovedRouteStepResponse> approvedOptions = processingOptions.stream()
                                        .map(this::toStoreApprovedRouteStepResponse)
                                        .toList();

                        List<MatFlowStockBalance> balances = stockRepository.findPlanningCandidates(
                                        line.material.getId(),
                                        Set.of(MatFlowPlantRoutingService.MAIN_STORE_PLANT),
                                        PLANNING_SOURCE_TYPES);

                        List<StoreStockOptionResponse> stockOptions = balances == null ? List.of()
                                        : balances.stream()
                                                        .filter(balance -> balance != null && balance.location != null)
                                                        .filter(balance -> mainStore.getId()
                                                                        .equals(balance.location.getId()))
                                                        .map(balance -> new StoreStockOptionResponse(
                                                                        balance.getId(),
                                                                        line.material.getId(),
                                                                        line.material.getMaterialCode(),
                                                                        line.material.getMaterialName(),
                                                                        balance.location.getId(),
                                                                        balance.location.getLocationCode(),
                                                                        balance.location.getLocationName(),
                                                                        balance.location.getPlantCode(),
                                                                        balance.location.getLocationType(),
                                                                        zero(balance.onHandQty),
                                                                        zero(balance.reservedQty),
                                                                        zero(balance.blockedQty),
                                                                        zero(balance.availableQty()),
                                                                        false, false, true))
                                                        .toList();

                        return new StoreLineAvailabilityResponse(
                                        line.getId(), line.lineNo,
                                        line.material.getId(), line.material.getMaterialCode(),
                                        line.material.getMaterialName(),
                                        clean(line.bomLine.getMaterialCategorySnapshot()), line.material.getUom(),
                                        zero(line.requestedQty), zero(line.reservedQty), zero(line.shortageQty),
                                        requisition.destinationLocation.getId(),
                                        requisition.destinationLocation.getLocationCode(),
                                        approvedOptions, stockOptions);
                }).toList();
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

        private MatFlowBomRouteStep validateStoreRouteConfirmation(
                        StoreLineReviewRequest lineReview,
                        List<MatFlowBomRouteStep> approvedProcessingOptions,
                        MatFlowMaterial material) {
                if (lineReview == null) {
                        throw badRequest("Store review line is required");
                }

                String materialLabel = material == null
                                ? "selected material"
                                : safeLabel(material.getMaterialCode(), material.getId());

                if (lineReview.qcRequired() == null) {
                        throw badRequest("Store must decide whether QC is required for material " + materialLabel);
                }
                if (lineReview.processingRequired() == null) {
                        throw badRequest("Store must decide whether Processing is required for material "
                                        + materialLabel);
                }

                List<MatFlowBomRouteStep> options = approvedProcessingOptions == null
                                ? List.of()
                                : approvedProcessingOptions;

                if (!Boolean.TRUE.equals(lineReview.processingRequired())) {
                        if (lineReview.processingRouteStepId() != null) {
                                throw badRequest(
                                                "Processing Unit must be empty when Processing is not required for material "
                                                                + materialLabel);
                        }
                        return null;
                }

                if (lineReview.processingRouteStepId() == null) {
                        throw badRequest("Select one approved Processing Unit for material " + materialLabel);
                }

                MatFlowBomRouteStep selected = options.stream()
                                .filter(step -> step != null
                                                && step.getId() != null
                                                && step.getId().equals(lineReview.processingRouteStepId()))
                                .findFirst()
                                .orElseThrow(() -> badRequest(
                                                "Selected Processing Unit is not approved on this BOM material line: "
                                                                + materialLabel));

                if (selected.stepType != RouteStepType.PROCESSING || selected.location == null) {
                        throw conflict("Selected BOM option is not a valid Processing Unit");
                }
                return selected;
        }

        /*
         * =====================================================
         * VALIDATION
         * =====================================================
         */
        private void validateDestination(
                        MatFlowLocation requisitionDestination,
                        List<MatFlowBomRouteStep> route) {
                if (requisitionDestination == null
                                || requisitionDestination.getLocationType() != LocationType.PRODUCTION) {
                        throw conflict("MR destination must be a valid Production location");
                }
        }

        private void validateRoute(
                        List<MatFlowBomRouteStep> route) {
                if (route == null) {
                        return;
                }
                for (MatFlowBomRouteStep step : route) {
                        if (step == null || step.location == null) {
                                throw conflict("BOM Processing option contains an incomplete step");
                        }
                        if (step.stepType != RouteStepType.PROCESSING) {
                                throw conflict(
                                                "BOM execution route is invalid for the current MatFlow workflow. " +
                                                                "Only Processing options belong on the BOM; Store decides QC.");
                        }
                        LocationType type = step.location.getLocationType();
                        if (type != LocationType.PROCESSING && type != LocationType.EXTERNAL_PROCESSOR) {
                                throw conflict("Configured Processing option is not a Processing location");
                        }
                        /*
                         * AL-P1 Main Store may route a central lot to any BOM-approved
                         * Processing Unit. Destination plant permission belongs to the
                         * Processing user who executes that unit; it must not block the
                         * Main Store planning decision.
                         */
                        requirePlantCode(
                                        step.location.getPlantCode(),
                                        "BOM Processing option " + safeLabel(step.location.getLocationCode(),
                                                        step.location.getId()));
                        if (!step.location.isActive()) {
                                throw conflict("BOM Processing option is inactive: " + step.location.getLocationCode());
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

                requireRequisitionPlantVisibility(
                                requisition,
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
                MatFlowLocation destination = locationRepository
                                .findById(requisition.destinationLocation.getId())
                                .orElseThrow(() -> conflict(
                                                "Material requisition destination location no longer exists"));

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

                String originPlant = plantRoutingService.normalizeFactoryPlant(destinationPlantCode);
                if (requisition.originStore != null) {
                        requisition.originStore = locationRepository.findById(requisition.originStore.getId())
                                        .orElseThrow(() -> conflict(
                                                        "Material requisition origin Store no longer exists"));
                        plantRoutingService.assertOriginStoreLocation(
                                        requisition.originStore, originPlant, "Material requisition origin Store");
                }
                if (requisition.mainStore != null) {
                        requisition.mainStore = locationRepository.findById(requisition.mainStore.getId())
                                        .orElseThrow(() -> conflict(
                                                        "Material requisition Main Store no longer exists"));
                        plantRoutingService.assertMainStoreLocation(
                                        requisition.mainStore, "Material requisition Main Store");
                }

                return requisition;
        }

        private MatFlowMaterialRequisition requireRequisitionForRouting(UUID id) {
                MatFlowMaterialRequisition requisition = requisitionRepository.findById(id)
                                .orElseThrow(() -> notFound("Material requisition not found"));
                requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(requisition);
                if (requisition.projectDrawing == null || requisition.destinationLocation == null) {
                        throw conflict("Material requisition has incomplete Plant routing context");
                }
                requisition.projectDrawing = projectRepository.findById(requisition.projectDrawing.getId())
                                .orElseThrow(() -> conflict("Material requisition project drawing no longer exists"));
                requisition.destinationLocation = locationRepository.findById(requisition.destinationLocation.getId())
                                .orElseThrow(() -> conflict(
                                                "Material requisition Production destination no longer exists"));
                if (requisition.bom != null) {
                        requisition.bom = bomRepository.findById(requisition.bom.getId())
                                        .orElseThrow(() -> conflict(
                                                        "Material requisition operational BOM no longer exists"));
                }
                if (requisition.originStore != null) {
                        requisition.originStore = locationRepository.findById(requisition.originStore.getId())
                                        .orElseThrow(() -> conflict(
                                                        "Material requisition origin Store no longer exists"));
                }
                if (requisition.mainStore != null) {
                        requisition.mainStore = locationRepository.findById(requisition.mainStore.getId())
                                        .orElseThrow(() -> conflict(
                                                        "Material requisition Main Store no longer exists"));
                }
                return requisition;
        }

        private MatFlowMaterialRequisition requireRequisitionForMainStore(UUID id) {
                MatFlowMaterialRequisition requisition = requireRequisitionForRouting(id);
                String originPlant = plantRoutingService.normalizeFactoryPlant(
                                requisition.destinationLocation.getPlantCode());
                if (!plantRoutingService.canActAsMainStore()) {
                        throw new org.springframework.security.access.AccessDeniedException(
                                        "AL-P1 Main Store access is required");
                }
                if (!plantRoutingService.isMainStorePlant(originPlant)
                                && requisition.status == RequisitionStatus.SUBMITTED_TO_STORE) {
                        throw conflict("The origin Plant Store has not yet forwarded this MR to AL-P1 Main Store");
                }
                return requisition;
        }

        private void requireAtMainStore(MatFlowMaterialRequisition requisition) {
                if (requisition == null || requisition.destinationLocation == null) {
                        throw conflict("Material requisition has no Production plant context");
                }
                String originPlant = plantRoutingService.normalizeFactoryPlant(
                                requisition.destinationLocation.getPlantCode());
                if (!plantRoutingService.isMainStorePlant(originPlant)
                                && requisition.status == RequisitionStatus.SUBMITTED_TO_STORE) {
                        throw conflict("MR must be forwarded by " + originPlant
                                        + " Store before AL-P1 Main Store can review it");
                }
        }

        private void requireRequisitionPlantVisibility(
                        MatFlowMaterialRequisition requisition,
                        String originPlantCode) {
                if (accessService.canAccessPlant(originPlantCode)) {
                        return;
                }
                boolean routedToMainStore = plantRoutingService.canActAsMainStore()
                                && requisition != null
                                && requisition.status != RequisitionStatus.DRAFT
                                && requisition.status != RequisitionStatus.SUBMITTED_TO_STORE;
                if (!routedToMainStore) {
                        accessService.requirePlantAccess(originPlantCode);
                }
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

                                                        line.status,
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

                                requisition.originStore == null ? null : requisition.originStore.getId(),
                                requisition.originStore == null ? null : requisition.originStore.getLocationCode(),
                                requisition.originStore == null ? null : requisition.originStore.getPlantCode(),
                                requisition.mainStore == null ? null : requisition.mainStore.getId(),
                                requisition.mainStore == null ? null : requisition.mainStore.getLocationCode(),
                                requisition.mainStore == null ? null : requisition.mainStore.getPlantCode(),

                                requisition.status,

                                requisition.requestedBy,
                                requisition.requestedAt,

                                requisition.submittedBy,
                                requisition.submittedAt,

                                requisition.forwardedToMainStoreBy,
                                requisition.forwardedToMainStoreAt,
                                requisition.forwardingRemarks,

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

        private boolean isAwaitingProductionReceipt(
                        MatFlowReservation reservation,
                        MatFlowLocation productionDestination) {
                if (reservation == null || reservation.getId() == null || productionDestination == null) {
                        return false;
                }

                return transferRepository
                                .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId())
                                .stream()
                                .filter(transfer -> transfer != null && transfer.toLocation != null)
                                .filter(transfer -> productionDestination.getId().equals(transfer.toLocation.getId()))
                                .anyMatch(transfer -> transfer.status == TransferStatus.IN_TRANSIT
                                                || transfer.status == TransferStatus.PARTIALLY_DISPATCHED
                                                || transfer.status == TransferStatus.PARTIALLY_RECEIVED);
        }

        private ReservationResponse toReservationResponse(
                        MatFlowReservation reservation) {
                if (reservation == null) {
                        throw conflict("Reservation is required");
                }
                reservation = (MatFlowReservation) Hibernate.unproxy(reservation);
                if (reservation.requisitionLine == null || reservation.material == null
                                || reservation.sourceLocation == null
                                || reservation.firstDestinationLocation == null) {
                        throw conflict("Reservation record is incomplete");
                }

                MatFlowRequisitionLine reservationLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                reservation.requisitionLine);
                reservation.requisitionLine = reservationLine;
                if (reservationLine.requisition == null || reservationLine.requisition.getId() == null) {
                        throw conflict("Reservation requisition link is missing");
                }
                MatFlowMaterialRequisition reservationRequisition = requireRequisition(
                                reservationLine.requisition.getId());

                List<MatFlowTransferOrder> route = transferRepository
                                .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId());
                MatFlowTransferOrder nextTransfer = route.stream()
                                .filter(transfer -> transfer != null
                                                && transfer.status != TransferStatus.RECEIVED
                                                && transfer.status != TransferStatus.CANCELLED)
                                .findFirst().orElse(null);

                MatFlowLocation issueLocation = nextTransfer != null && nextTransfer.fromLocation != null
                                ? nextTransfer.fromLocation
                                : reservationRequisition.destinationLocation;

                BigDecimal reservedQty = zero(reservation.reservedQty);
                BigDecimal issuedQty = zero(reservation.issuedQty);
                BigDecimal remainingIssueQty = reservedQty.subtract(issuedQty)
                                .max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);

                boolean qcRequired = qcRequiredForReservation(reservation);
                boolean qcCompleted = qcCompletedForReservation(reservation);
                boolean processingRequired = processingRequiredForReservation(reservation);
                boolean alreadyIssued = reservation.status == ReservationStatus.ISSUED;

                boolean issueReady = nextTransfer != null
                                && nextTransfer.status == TransferStatus.READY
                                && nextTransfer.fromLocation != null
                                && nextTransfer.fromLocation.getLocationType() == LocationType.STORE
                                && remainingIssueQty.compareTo(BigDecimal.ZERO) > 0
                                && (reservation.status == ReservationStatus.ACTIVE
                                                || reservation.status == ReservationStatus.PARTIALLY_ISSUED);

                String responsibleDepartment;
                String nextAction;
                if (alreadyIssued || nextTransfer == null) {
                        responsibleDepartment = "PRODUCTION";
                        nextAction = "START_PRODUCTION";
                } else if (qcRequired && !qcCompleted && nextTransfer.predecessorTransferId == null) {
                        responsibleDepartment = "QC";
                        nextAction = "COMPLETE_QC_CHECK";
                } else if (nextTransfer.status == TransferStatus.IN_TRANSIT
                                || nextTransfer.status == TransferStatus.PARTIALLY_DISPATCHED
                                || nextTransfer.status == TransferStatus.PARTIALLY_RECEIVED) {
                        if (nextTransfer.toLocation != null
                                        && nextTransfer.toLocation.getLocationType() == LocationType.PRODUCTION) {
                                responsibleDepartment = "PRODUCTION";
                                nextAction = "RECEIVE_MATERIAL";
                        } else if (nextTransfer.toLocation != null
                                        && nextTransfer.toLocation.getLocationType() == LocationType.STORE
                                        && !plantRoutingService.isMainStoreLocation(nextTransfer.toLocation)) {
                                responsibleDepartment = "ORIGIN PLANT STORE";
                                nextAction = "RECEIVE_FROM_MAIN_STORE";
                        } else {
                                responsibleDepartment = departmentForLocation(nextTransfer.toLocation);
                                nextAction = "RECEIVE_MATERIAL";
                        }
                } else if (nextTransfer.status == TransferStatus.READY) {
                        responsibleDepartment = nextTransfer.fromLocation != null
                                        && plantRoutingService.isMainStoreLocation(nextTransfer.fromLocation)
                                                        ? "AL-P1 MAIN STORE"
                                                        : departmentForLocation(nextTransfer.fromLocation);
                        nextAction = "ISSUE_MATERIAL";
                } else if (nextTransfer.fromLocation != null
                                && (nextTransfer.fromLocation.getLocationType() == LocationType.PROCESSING
                                                || nextTransfer.fromLocation
                                                                .getLocationType() == LocationType.EXTERNAL_PROCESSOR)) {
                        responsibleDepartment = "PROCESSING";
                        nextAction = "COMPLETE_PROCESSING";
                } else {
                        responsibleDepartment = "AL-P1 MAIN STORE";
                        nextAction = "AWAIT_ROUTE_PREREQUISITE";
                }

                return new ReservationResponse(
                                reservation.getId(),
                                reservation.requisitionLine.getId(),
                                reservation.material.getMaterialCode(),
                                reservation.sourceLocation.getId(),
                                reservation.sourceLocation.getLocationCode(),
                                reservation.sourceLocation.getPlantCode(),
                                reservation.firstDestinationLocation.getId(),
                                reservation.firstDestinationLocation.getLocationCode(),
                                reservation.demandPlantCode,
                                reservedQty, reservation.status, reservation.getRowVersion(),
                                issuedQty, remainingIssueQty, issueReady,
                                issueLocation == null ? null : issueLocation.getId(),
                                issueLocation == null ? null : issueLocation.getLocationCode(),
                                responsibleDepartment, nextAction,
                                qcRequired, qcCompleted, processingRequired,
                                processingRouteStepIdForReservation(reservation),
                                processingLocationCodeForReservation(reservation));
        }

        private MatFlowQcInspection qcCheckForReservation(MatFlowReservation reservation) {
                if (reservation == null || reservation.getId() == null) {
                        return null;
                }
                MatFlowQcInspection direct = qcRepository
                                .findBySourceTypeAndSourceLineId(
                                                QcSourceType.TRANSFER_RECEIPT,
                                                reservation.getId())
                                .orElse(null);
                if (direct != null) {
                        return direct;
                }
                /* Historical compatibility for pre-simplification QC rows. */
                return qcRepository.findAllByOrderByCreatedAtDesc().stream()
                                .filter(check -> check != null
                                                && reservation.getId().equals(check.routingReservationId))
                                .findFirst()
                                .orElse(null);
        }

        private boolean qcRequiredForReservation(MatFlowReservation reservation) {
                return qcCheckForReservation(reservation) != null;
        }

        private boolean qcCompletedForReservation(MatFlowReservation reservation) {
                MatFlowQcInspection check = qcCheckForReservation(reservation);
                return check != null && check.status == QcInspectionStatus.COMPLETED;
        }

        private boolean processingRequiredForReservation(MatFlowReservation reservation) {
                if (reservation == null || reservation.firstDestinationLocation == null) {
                        return false;
                }
                LocationType type = reservation.firstDestinationLocation.getLocationType();
                return type == LocationType.PROCESSING || type == LocationType.EXTERNAL_PROCESSOR;
        }

        private UUID processingRouteStepIdForReservation(MatFlowReservation reservation) {
                if (reservation == null || reservation.getId() == null) {
                        return null;
                }
                return transferRepository
                                .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId())
                                .stream()
                                .filter(transfer -> transfer != null
                                                && transfer.toLocation != null
                                                && (transfer.toLocation.getLocationType() == LocationType.PROCESSING
                                                                || transfer.toLocation
                                                                                .getLocationType() == LocationType.EXTERNAL_PROCESSOR))
                                .map(transfer -> transferLineRepository
                                                .findFirstByTransferOrder_IdOrderByCreatedAtAsc(transfer.getId())
                                                .map(line -> line.routeStepId)
                                                .orElse(null))
                                .filter(java.util.Objects::nonNull)
                                .findFirst()
                                .orElse(null);
        }

        private String processingLocationCodeForReservation(MatFlowReservation reservation) {
                return processingRequiredForReservation(reservation)
                                ? reservation.firstDestinationLocation.getLocationCode()
                                : null;
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

                MatFlowMaterialRequisition linkedRequisition = indent.requisition == null
                                ? null
                                : (MatFlowMaterialRequisition) Hibernate.unproxy(indent.requisition);
                MatFlowProjectDrawing linkedProduct = indent.projectDrawing == null
                                ? null
                                : (MatFlowProjectDrawing) Hibernate.unproxy(indent.projectDrawing);

                return new IndentResponse(
                                indent.getId(),
                                indent.indentNumber,
                                linkedRequisition == null ? null : linkedRequisition.getId(),
                                linkedRequisition == null ? null : linkedRequisition.requisitionNumber,
                                linkedProduct == null ? null : linkedProduct.getId(),
                                linkedProduct == null ? null : linkedProduct.getProjectCode(),
                                linkedProduct == null ? null : linkedProduct.getDrawingNo(),
                                linkedProduct == null ? null : linkedProduct.getProductName(),
                                linkedProduct == null ? null : linkedProduct.getClientName(),

                                indent.deliverToLocation
                                                .getId(),

                                indent.deliverToLocation
                                                .getLocationCode(),

                                indent.deliverToLocation
                                                .getPlantCode(),

                                indent.status,
                                !indent.autoGenerated,
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
                plantRoutingService.requireMainStorePlanningActor();
                if (requisitionId == null)
                        throw badRequest("Requisition ID is required");
                if (request == null || request.lines() == null || request.lines().isEmpty()) {
                        throw badRequest("At least one Main Store review line is required");
                }

                requisitionRepository.lockById(requisitionId)
                                .orElseThrow(() -> notFound("Material requisition not found"));
                MatFlowMaterialRequisition requisition = requireRequisitionForMainStore(requisitionId);
                requireAtMainStore(requisition);
                if (!isStoreReviewableStatus(requisition.status)) {
                        throw conflict("Requisition cannot be reviewed by Main Store in status: " + requisition.status);
                }
                assertVersion(request.rowVersion(), requisition.getRowVersion(), "Requisition");

                MatFlowLocation mainStore = requisition.mainStore == null
                                ? plantRoutingService.requireMainStore()
                                : requisition.mainStore;
                plantRoutingService.assertMainStoreLocation(mainStore, "MR review Main Store");
                String demandPlant = plantRoutingService.normalizeFactoryPlant(
                                requisition.destinationLocation.getPlantCode());

                List<MatFlowRequisitionLine> lines = requisitionLineRepository.lockByRequisitionId(requisition.getId());
                Map<UUID, MatFlowRequisitionLine> lineById = lines.stream()
                                .collect(java.util.stream.Collectors.toMap(
                                                MatFlowRequisitionLine::getId, value -> value,
                                                (a, b) -> a, LinkedHashMap::new));
                Map<UUID, StoreLineReviewRequest> reviewByLineId = new LinkedHashMap<>();
                for (StoreLineReviewRequest lineReview : request.lines()) {
                        if (lineReview == null || lineReview.requisitionLineId() == null) {
                                throw badRequest("Every Main Store review line requires a requisition line ID");
                        }
                        if (!lineById.containsKey(lineReview.requisitionLineId())) {
                                throw badRequest("Store review contains a line that does not belong to this MR");
                        }
                        if (reviewByLineId.put(lineReview.requisitionLineId(), lineReview) != null) {
                                throw badRequest("The same requisition line cannot be reviewed more than once");
                        }
                }

                String actor = accessService.actor();
                int reviewedLines = 0;

                for (StoreLineReviewRequest lineReview : reviewByLineId.values()) {
                        MatFlowRequisitionLine line = lineById.get(lineReview.requisitionLineId());
                        if (line.material == null || line.bomLine == null) {
                                throw conflict("Requisition contains an incomplete material line");
                        }
                        assertVersion(lineReview.rowVersion(), line.getRowVersion(), "Requisition line");

                        BigDecimal requestedQty = positive(line.requestedQty, "Requested quantity");
                        BigDecimal alreadyAllocated = zero(line.reservedQty).min(requestedQty);
                        BigDecimal remainingDemand = requestedQty.subtract(alreadyAllocated)
                                        .max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);
                        if (remainingDemand.compareTo(BigDecimal.ZERO) <= 0) {
                                throw conflict("Material " + line.material.getMaterialCode()
                                                + " is already fully allocated to this MR");
                        }

                        List<MatFlowBomRouteStep> processingOptions = routingService.routeForLine(line.bomLine.getId());
                        processingOptions = processingOptions == null ? List.of() : processingOptions;
                        validateRoute(processingOptions);
                        MatFlowBomRouteStep selectedProcessingStep = validateStoreRouteConfirmation(
                                        lineReview, processingOptions, line.material);

                        MatFlowLocation firstDestination = selectedProcessingStep == null
                                        ? (plantRoutingService.requiresOriginStoreHop(demandPlant)
                                                        ? plantRoutingService.requireOriginStore(demandPlant)
                                                        : requisition.destinationLocation)
                                        : selectedProcessingStep.location;

                        List<StoreSourceAllocationRequest> allocations = lineReview.allocations() == null
                                        ? List.of()
                                        : lineReview.allocations();
                        Set<UUID> usedSources = new LinkedHashSet<>();
                        BigDecimal allocatedThisReview = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

                        for (StoreSourceAllocationRequest allocation : allocations) {
                                if (allocation == null || allocation.sourceLocationId() == null) {
                                        throw badRequest("A Main Store allocation contains no source location");
                                }
                                if (!usedSources.add(allocation.sourceLocationId())) {
                                        throw badRequest(
                                                        "The same Main Store source cannot be selected twice for one material line");
                                }
                                BigDecimal qty = positive(allocation.reserveQty(), "Reserve quantity");
                                if (allocatedThisReview.add(qty).compareTo(remainingDemand) > 0) {
                                        throw badRequest("Store allocation exceeds remaining MR demand for "
                                                        + line.material.getMaterialCode());
                                }

                                MatFlowLocation source = locationRepository.findById(allocation.sourceLocationId())
                                                .orElseThrow(() -> notFound("Store source location not found"));
                                plantRoutingService.assertMainStoreLocation(source, "MR stock reservation");
                                if (!mainStore.getId().equals(source.getId())) {
                                        throw badRequest(
                                                        "MR stock may be reserved only from the configured AL-P1 Main Store");
                                }

                                MatFlowStockBalance balance = stockRepository
                                                .lockBalance(line.material.getId(), source.getId())
                                                .orElseThrow(() -> conflict("No stock balance exists for "
                                                                + line.material.getMaterialCode() + " at "
                                                                + source.getLocationCode()));
                                BigDecimal available = zero(balance.availableQty());
                                if (available.compareTo(qty) < 0) {
                                        throw conflict("Available Main Store stock is " + available
                                                        + ", requested reserve is " + qty);
                                }

                                balance.reservedQty = zero(balance.reservedQty).add(qty)
                                                .setScale(3, RoundingMode.HALF_UP);
                                balance.setUpdatedBy(actor);
                                balance = stockRepository.save(balance);

                                MatFlowReservation reservation = new MatFlowReservation();
                                reservation.requisitionLine = line;
                                reservation.material = line.material;
                                reservation.sourceLocation = source;
                                reservation.firstDestinationLocation = firstDestination;
                                reservation.demandPlantCode = demandPlant;
                                reservation.reservedQty = qty;
                                reservation.issuedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                                reservation.status = ReservationStatus.ACTIVE;
                                reservation.routeSnapshotJson = routeSnapshot(
                                                Boolean.TRUE.equals(lineReview.qcRequired()),
                                                Boolean.TRUE.equals(lineReview.processingRequired()),
                                                selectedProcessingStep, requisition.destinationLocation);
                                reservation.setCreatedBy(actor);
                                reservation.setUpdatedBy(actor);
                                reservation = reservationRepository.saveAndFlush(reservation);

                                saveReservationLedger(balance, requisition, reservation, qty, actor);
                                createTransferChain(requisition, reservation, selectedProcessingStep, qty,
                                                Boolean.TRUE.equals(lineReview.qcRequired()), actor);
                                if (Boolean.TRUE.equals(lineReview.qcRequired())) {
                                        createQcCheck(requisition, reservation, qty, actor);
                                }
                                allocatedThisReview = allocatedThisReview.add(qty)
                                                .setScale(3, RoundingMode.HALF_UP);
                        }

                        BigDecimal newAllocatedTotal = alreadyAllocated.add(allocatedThisReview)
                                        .min(requestedQty).setScale(3, RoundingMode.HALF_UP);
                        BigDecimal shortage = requestedQty.subtract(newAllocatedTotal)
                                        .max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);

                        if (shortage.compareTo(BigDecimal.ZERO) > 0
                                        && !Boolean.TRUE.equals(lineReview.createIndentForShortage())) {
                                throw badRequest("Material " + line.material.getMaterialCode()
                                                + " still has shortage " + shortage
                                                + ". Keep/create a linked Main Store PI for the shortage.");
                        }

                        line.reservedQty = newAllocatedTotal;
                        line.shortageQty = shortage;
                        if (clean(lineReview.remarks()) != null)
                                line.remarks = clean(lineReview.remarks());
                        line.setUpdatedBy(actor);
                        requisitionLineRepository.save(line);

                        if (shortage.compareTo(BigDecimal.ZERO) > 0) {
                                ensureLinkedIndentLine(requisition, line, shortage,
                                                lineReview.indentDeliveryLocationId(), request.remarks(),
                                                lineReview.remarks(), actor);
                        }
                        reviewedLines++;
                }

                boolean requisitionHasShortage = lines.stream()
                                .anyMatch(line -> zero(line.shortageQty).compareTo(BigDecimal.ZERO) > 0);
                requisition.status = requisitionHasShortage
                                ? RequisitionStatus.SHORTAGE_PENDING
                                : RequisitionStatus.PARTIALLY_RESERVED;
                requisition.plannedBy = actor;
                requisition.plannedAt = LocalDateTime.now();
                if (clean(request.remarks()) != null)
                        requisition.remarks = clean(request.remarks());
                requisition.setUpdatedBy(actor);
                requisitionRepository.saveAndFlush(requisition);

                refreshState(requisition.getId(), actor);
                MatFlowMaterialRequisition refreshed = requireRequisitionForMainStore(requisition.getId());

                auditService.record(
                                "REQUISITION", requisition.getId(), "MAIN_STORE_REVIEW_COMPLETED",
                                MatFlowPlantRoutingService.MAIN_STORE_PLANT,
                                requisition.projectDrawing == null ? null : requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing == null ? null : requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber", requisition.requisitionNumber,
                                                "originPlant", demandPlant,
                                                "mainStoreCode", mainStore.getLocationCode(),
                                                "reviewedLines", reviewedLines,
                                                "status", refreshed.status));

                return toPlanningResponse(refreshed);
        }

        private void ensureLinkedIndentLine(
                        MatFlowMaterialRequisition requisition,
                        MatFlowRequisitionLine requisitionLine,
                        BigDecimal shortageQty,
                        UUID indentDeliveryLocationId,
                        String requisitionRemarks,
                        String lineRemarks,
                        String actor) {
                MatFlowLocation requestedDeliveryStore = resolveIndentStore(
                                requisition,
                                indentDeliveryLocationId);

                List<MatFlowIndent> existingIndents = indentRepository
                                .findByRequisition_IdOrderByCreatedAtAsc(requisition.getId());
                Set<UUID> closedForThisMaterial = new LinkedHashSet<>();

                for (MatFlowIndent indent : existingIndents) {
                        if (indent == null || !isReusableIndentForShortage(indent.status))
                                continue;

                        MatFlowIndentLine existingLine = indentLineRepository
                                        .findByIndent_IdOrderByCreatedAtAsc(indent.getId())
                                        .stream()
                                        .filter(value -> value.requisitionLine != null &&
                                                        requisitionLine.getId().equals(value.requisitionLine.getId()))
                                        .findFirst().orElse(null);

                        if (existingLine != null) {
                                if (indent.deliverToLocation == null ||
                                                !requestedDeliveryStore.getId()
                                                                .equals(indent.deliverToLocation.getId())) {
                                        throw conflict("Existing linked PI for material "
                                                        + requisitionLine.material.getMaterialCode()
                                                        + " is assigned to a different Store delivery location");
                                }

                                BigDecimal previousRequired = zero(existingLine.requiredQty);
                                BigDecimal previousOrdered = zero(existingLine.orderedQty);
                                BigDecimal previousReceived = zero(existingLine.receivedQty);
                                boolean fullyProcuredAndReceived = previousRequired.compareTo(BigDecimal.ZERO) > 0
                                                && previousOrdered.compareTo(previousRequired) >= 0
                                                && previousReceived.compareTo(previousRequired) >= 0;

                                /*
                                 * A later replacement demand (for example Processing wastage)
                                 * must never be hidden inside a PI line whose earlier quantity is
                                 * already fully ordered and received. Store raises a fresh PI for
                                 * that new shortage so procurement history remains exact.
                                 */
                                if (fullyProcuredAndReceived) {
                                        closedForThisMaterial.add(indent.getId());
                                        continue;
                                }

                                BigDecimal committedFloor = previousOrdered.max(previousReceived);
                                existingLine.requiredQty = shortageQty.max(committedFloor)
                                                .setScale(3, RoundingMode.HALF_UP);
                                existingLine.setUpdatedBy(actor);
                                indentLineRepository.save(existingLine);

                                if (indent.status == IndentStatus.AUTO_CREATED || indent.status == IndentStatus.DRAFT) {
                                        indent.status = IndentStatus.SUBMITTED_TO_PURCHASE;
                                        indent.setUpdatedBy(actor);
                                        indentRepository.save(indent);
                                }
                                return;
                        }
                }

                MatFlowLocation deliveryStore = requestedDeliveryStore;
                MatFlowIndent indent = existingIndents.stream()
                                .filter(value -> value != null && !closedForThisMaterial.contains(value.getId()))
                                .filter(value -> isReusableIndentForShortage(value.status) &&
                                                value.deliverToLocation != null &&
                                                value.deliverToLocation.getId().equals(deliveryStore.getId()))
                                .findFirst()
                                .orElseGet(() -> createIndent(requisition, deliveryStore, requisitionRemarks, actor));

                MatFlowIndentLine indentLine = new MatFlowIndentLine();
                indentLine.indent = indent;
                indentLine.requisitionLine = requisitionLine;
                indentLine.material = requisitionLine.material;
                indentLine.requiredQty = shortageQty;
                indentLine.orderedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                indentLine.receivedQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                indentLine.uom = requisitionLine.material.getUom();
                indentLine.remarks = clean(lineRemarks);
                if (indentLine.remarks == null)
                        indentLine.remarks = "Shortage confirmed against linked MR";
                indentLine.setCreatedBy(actor);
                indentLine.setUpdatedBy(actor);
                indentLineRepository.save(indentLine);
        }

        private boolean isReusableIndentForShortage(IndentStatus status) {
                if (status == null) {
                        return false;
                }
                return switch (status) {
                        case AUTO_CREATED, DRAFT, RETURNED, SUBMITTED_TO_PURCHASE,
                                        PURCHASE_IN_PROGRESS, PO_CREATED, PARTIALLY_RECEIVED ->
                                true;
                        case RECEIVED, CANCELLED -> false;
                };
        }

        private MatFlowLocation resolveIndentStore(
                        MatFlowMaterialRequisition requisition,
                        UUID deliveryLocationId) {
                MatFlowLocation mainStore = requisition != null && requisition.mainStore != null
                                ? requisition.mainStore
                                : plantRoutingService.requireMainStore();
                plantRoutingService.assertMainStoreLocation(mainStore, "Purchase Indent delivery");

                if (deliveryLocationId != null && !deliveryLocationId.equals(mainStore.getId())) {
                        throw badRequest("Purchase Indent delivery location is fixed to AL-P1 Main Store");
                }
                return mainStore;
        }

        private MatFlowIndent createIndent(
                        MatFlowMaterialRequisition requisition,
                        MatFlowLocation deliveryLocation,
                        String remarks,
                        String actor) {

                MatFlowIndent indent = new MatFlowIndent();

                indent.indentNumber = documentNumberService.nextPi();

                indent.requisition = requisition;

                indent.projectDrawing = requisition.projectDrawing;

                indent.bom = requisition.bom;

                indent.deliverToLocation = deliveryLocation;

                indent.status = IndentStatus.SUBMITTED_TO_PURCHASE;

                indent.autoGenerated = false;

                indent.remarks = clean(
                                remarks);

                if (indent.remarks == null) {
                        indent.remarks = "Raised by Store from confirmed MR shortage";
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

                                        yield "PRODUCTION";
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

                                        yield "START_PRODUCTION";
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
                        boolean qcRequired,
                        boolean processingRequired,
                        MatFlowBomRouteStep processingStep,
                        MatFlowLocation productionDestination) {

                Map<String, Object> snapshot = new LinkedHashMap<>();
                snapshot.put("qcRequired", qcRequired);
                snapshot.put("processingRequired", processingRequired);
                snapshot.put("processingStep",
                                processingStep == null ? null : routeStepSnapshot(processingStep));

                Map<String, Object> production = new LinkedHashMap<>();
                production.put("locationId",
                                productionDestination == null ? null : productionDestination.getId());
                production.put("locationCode",
                                productionDestination == null ? null : productionDestination.getLocationCode());
                production.put("plantCode",
                                productionDestination == null ? null : productionDestination.getPlantCode());
                snapshot.put("productionDestination", production);

                try {
                        return objectMapper.writeValueAsString(snapshot);
                } catch (JsonProcessingException ex) {
                        throw new IllegalStateException("Unable to capture Store routing snapshot", ex);
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
                if (status == null)
                        return false;
                return switch (status.name()) {
                        case "SUBMITTED", "SUBMITTED_TO_STORE", "STORE_REVIEW_IN_PROGRESS",
                                        "PARTIALLY_RESERVED", "SHORTAGE_PENDING", "READY_TO_ISSUE",
                                        "PARTIALLY_ISSUED" ->
                                true;
                        default -> false;
                };
        }

        /*
         * =====================================================
         * HELPERS
         * =====================================================
         */

        private boolean canReadRequisition(
                        MatFlowMaterialRequisition requisition) {
                if (requisition == null || requisition.projectDrawing == null) {
                        return false;
                }
                String plantCode = clean(requisition.projectDrawing.getPlantCode());
                if (plantCode == null) {
                        return false;
                }
                String originPlant;
                try {
                        originPlant = plantRoutingService.normalizeFactoryPlant(plantCode);
                } catch (ResponseStatusException ignored) {
                        return accessService.canAccessPlant(plantCode);
                }
                if (accessService.canAccessPlant(originPlant)) {
                        return true;
                }
                /*
                 * Main Store sees remote-plant MRs only after the origin Store forwards them.
                 */
                return plantRoutingService.canActAsMainStore()
                                && requisition.status != RequisitionStatus.DRAFT
                                && requisition.status != RequisitionStatus.SUBMITTED_TO_STORE;
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

        /**
         * Every Store-raised PI with its linked MR material lines. Historical
         * completed/cancelled PIs remain visible to Store so an MR list can always
         * show that a PI existed; the Purchase frontend independently filters only
         * actionable PI statuses when creating new POs.
         */
        @Transactional(readOnly = true)
        public List<IndentResponse> listPurchaseIndents(String plantCode) {
                accessService.requireIndentRead();

                /*
                 * PI delivery is always AL-P1 Main Store, so plantCode here means the
                 * originating MR/Production plant, not the PI delivery plant. This lets
                 * Main Store/Purchase filter central PIs for AL-P2/3/4 without granting
                 * those actors operational access to the remote plant.
                 */
                final String originPlantFilter = clean(plantCode) == null
                                ? null
                                : plantRoutingService.normalizeFactoryPlant(plantCode);

                return indentRepository.findAll().stream()
                                .filter(indent -> indent != null && indent.deliverToLocation != null)
                                .filter(indent -> accessService.canAccessPlant(indent.deliverToLocation.getPlantCode()))
                                .filter(indent -> {
                                        if (originPlantFilter == null) {
                                                return true;
                                        }
                                        MatFlowMaterialRequisition linked = indent.requisition;
                                        if (linked == null || linked.destinationLocation == null) {
                                                return false;
                                        }
                                        try {
                                                return originPlantFilter
                                                                .equals(plantRoutingService.normalizeFactoryPlant(
                                                                                linked.destinationLocation
                                                                                                .getPlantCode()));
                                        } catch (ResponseStatusException ignored) {
                                                return false;
                                        }
                                })
                                .filter(indent -> indent.status != IndentStatus.AUTO_CREATED
                                                && indent.status != IndentStatus.DRAFT)
                                .sorted(Comparator.comparing(
                                                MatFlowIndent::getCreatedAt,
                                                Comparator.nullsLast(Comparator.reverseOrder())))
                                .map(this::toIndentResponse)
                                .toList();
        }

        @Transactional(readOnly = true)
        public List<RequisitionResponse> listStoreQueue(String plantCode) {
                accessService.requireMaterialPlanning();

                String plantFilter = clean(plantCode);
                if (plantFilter != null) {
                        plantFilter = plantRoutingService.normalizeFactoryPlant(plantFilter);
                        if (!accessService.canAccessPlant(plantFilter)
                                        && !plantRoutingService.canActAsMainStore()) {
                                accessService.requirePlantAccess(plantFilter);
                        }
                }
                final String requestedOriginPlant = plantFilter;
                final boolean mainStoreActor = plantRoutingService.canActAsMainStore();

                return requisitionRepository.findAllByOrderByUpdatedAtDesc().stream()
                                .filter(requisition -> requisition != null
                                                && requisition.projectDrawing != null
                                                && requisition.destinationLocation != null)
                                .filter(requisition -> {
                                        String originPlant = clean(requisition.destinationLocation.getPlantCode());
                                        if (originPlant == null)
                                                return false;
                                        originPlant = originPlant.toUpperCase(Locale.ROOT);
                                        if (requestedOriginPlant != null
                                                        && !requestedOriginPlant.equals(originPlant))
                                                return false;

                                        if (mainStoreActor) {
                                                if (MatFlowPlantRoutingService.MAIN_STORE_PLANT.equals(originPlant)) {
                                                        return requisition.status != RequisitionStatus.DRAFT;
                                                }
                                                return requisition.status != RequisitionStatus.DRAFT
                                                                && requisition.status != RequisitionStatus.SUBMITTED_TO_STORE;
                                        }

                                        return accessService.canAccessPlant(originPlant)
                                                        && requisition.status != RequisitionStatus.DRAFT;
                                })
                                .filter(requisition -> isStoreQueueStatus(requisition.status))
                                .map(this::toRequisitionResponse)
                                .toList();
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
                /*
                 * Historical shortage-hold logic may activate a PLANNED custody row once
                 * its commercial dependency is closed. In the current workflow PLANNED
                 * also means "waiting for QC check" for the first Store hand-off, so that
                 * gate must never be bypassed here.
                 *
                 * Only the first Store-origin hand-off can be activated here, and only
                 * when the linked reservation has no pending QC check. Successor
                 * Processing -> Production rows remain PLANNED until Processing completes.
                 */
                transferRepository
                                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(requisitionId)
                                .stream()
                                .filter(transfer -> transfer.status == TransferStatus.PLANNED)
                                .filter(transfer -> transfer.predecessorTransferId == null)
                                .filter(transfer -> transfer.reservation == null || transfer.reservation.getId() == null
                                                ||
                                                qcRepository.findBySourceTypeAndSourceLineId(
                                                                QcSourceType.TRANSFER_RECEIPT,
                                                                transfer.reservation.getId())
                                                                .map(check -> check.status == QcInspectionStatus.COMPLETED)
                                                                .orElse(true))
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

                boolean headerStateFrozen = requisition.status == RequisitionStatus.CANCELLED ||
                                requisition.status == RequisitionStatus.PRODUCTION_STARTED ||
                                requisition.status == RequisitionStatus.PRODUCTION_COMPLETED;

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

                refreshMaterialLineStatuses(
                                requisition,
                                lines,
                                reservations,
                                clean(actor) == null ? accessService.actor() : actor);

                /* Production/Completed headers are explicit lifecycle states. */
                if (headerStateFrozen) {
                        return;
                }

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

        /**
         * Keeps the material-level workflow state synchronized with the physical
         * and commercial execution records. RequisitionLine.status is the primary
         * per-material state used by the tracker; it must not remain permanently
         * PENDING_STORE_REVIEW while the header progresses.
         */
        private void refreshMaterialLineStatuses(
                        MatFlowMaterialRequisition requisition,
                        List<MatFlowRequisitionLine> lines,
                        List<MatFlowReservation> reservations,
                        String actor) {

                Map<UUID, List<MatFlowReservation>> reservationsByLine = reservations == null
                                ? Map.of()
                                : reservations.stream()
                                                .filter(r -> r != null && r.requisitionLine != null
                                                                && r.requisitionLine.getId() != null)
                                                .collect(java.util.stream.Collectors.groupingBy(
                                                                r -> r.requisitionLine.getId(),
                                                                LinkedHashMap::new,
                                                                java.util.stream.Collectors.toList()));

                List<MatFlowIndent> requisitionIndents = indentRepository
                                .findByRequisition_Id(requisition.getId());

                for (MatFlowRequisitionLine line : lines) {
                        if (line == null || line.getId() == null) {
                                continue;
                        }

                        RequisitionLineStatus next = deriveMaterialLineStatus(
                                        requisition,
                                        line,
                                        reservationsByLine.getOrDefault(line.getId(), List.of()),
                                        requisitionIndents);

                        if (line.status != next) {
                                line.status = next;
                                line.setUpdatedBy(actor);
                                requisitionLineRepository.save(line);
                        }
                }
        }

        private BigDecimal productionWasteForLine(UUID requisitionLineId) {
                if (requisitionLineId == null) {
                        return BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                }
                return ledgerRepository.findAll().stream()
                                .filter(entry -> entry != null && entry.movementType == MovementType.SCRAP)
                                .filter(entry -> "MATFLOW_PRODUCTION_WASTE".equals(entry.referenceType))
                                .filter(entry -> requisitionLineId.equals(entry.referenceId))
                                .map(entry -> zero(entry.quantityChange).abs())
                                .reduce(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP), BigDecimal::add)
                                .setScale(3, RoundingMode.HALF_UP);
        }

        private RequisitionLineStatus deriveMaterialLineStatus(
                        MatFlowMaterialRequisition requisition,
                        MatFlowRequisitionLine line,
                        List<MatFlowReservation> reservations,
                        List<MatFlowIndent> requisitionIndents) {

                if (requisition.status == RequisitionStatus.CANCELLED) {
                        return RequisitionLineStatus.CANCELLED;
                }

                BigDecimal requested = zero(line.requestedQty);
                BigDecimal issued = zero(line.issuedQty);
                BigDecimal consumed = zero(line.consumedQty);
                BigDecimal returned = zero(line.returnedQty);
                BigDecimal productionWaste = productionWasteForLine(line.getId());
                BigDecimal accounted = consumed.add(returned).add(productionWaste);
                BigDecimal shortage = zero(line.shortageQty);
                BigDecimal reserved = zero(line.reservedQty);

                if (issued.compareTo(requested) >= 0 && issued.compareTo(BigDecimal.ZERO) > 0
                                && accounted.compareTo(issued) >= 0) {
                        if (returned.compareTo(BigDecimal.ZERO) > 0 && consumed.compareTo(BigDecimal.ZERO) == 0
                                        && productionWaste.compareTo(BigDecimal.ZERO) == 0) {
                                return RequisitionLineStatus.RETURNED;
                        }
                        // Legacy CONSUMED is the terminal fully-accounted line state. The
                        // tracker/material register expose wastage separately and precisely.
                        return RequisitionLineStatus.CONSUMED;
                }

                if (consumed.compareTo(BigDecimal.ZERO) > 0 || returned.compareTo(BigDecimal.ZERO) > 0
                                || productionWaste.compareTo(BigDecimal.ZERO) > 0) {
                        return RequisitionLineStatus.PARTIALLY_CONSUMED;
                }

                if (issued.compareTo(requested) >= 0 && requested.compareTo(BigDecimal.ZERO) > 0) {
                        return RequisitionLineStatus.ISSUED_TO_PRODUCTION;
                }

                if (issued.compareTo(BigDecimal.ZERO) > 0) {
                        return RequisitionLineStatus.PARTIALLY_ISSUED;
                }

                boolean processingInProgress = reservations.stream()
                                .flatMap(r -> processingRepository.findByReservation_Id(r.getId()).stream())
                                .anyMatch(job -> job.status == ProcessingJobStatus.IN_PROGRESS);
                if (processingInProgress) {
                        return RequisitionLineStatus.IN_PROCESSING;
                }

                boolean processingSelectedOrWaiting = reservations.stream().anyMatch(reservation -> {
                        boolean pendingJob = processingRepository.findByReservation_Id(reservation.getId()).stream()
                                        .anyMatch(job -> job.status == ProcessingJobStatus.PENDING);
                        if (pendingJob) {
                                return true;
                        }
                        return transferRepository.findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                        reservation.getId()).stream()
                                        .anyMatch(transfer -> transfer != null
                                                        && transfer.toLocation != null
                                                        && (transfer.toLocation
                                                                        .getLocationType() == LocationType.PROCESSING
                                                                        || transfer.toLocation
                                                                                        .getLocationType() == LocationType.EXTERNAL_PROCESSOR)
                                                        && transfer.status != TransferStatus.CANCELLED
                                                        && transfer.status != TransferStatus.RECEIVED);
                });
                if (processingSelectedOrWaiting) {
                        return RequisitionLineStatus.PROCESSING_REQUIRED;
                }

                boolean allIssueReady = !reservations.isEmpty() && reservations.stream()
                                .filter(r -> r.status != ReservationStatus.CANCELLED
                                                && r.status != ReservationStatus.RELEASED)
                                .allMatch(r -> r.status == ReservationStatus.ISSUED
                                                || isReservationIssueReady(r, requisition.destinationLocation));
                if (shortage.compareTo(BigDecimal.ZERO) <= 0 && allIssueReady) {
                        return RequisitionLineStatus.READY_TO_ISSUE;
                }

                boolean qcCustody = reservations.stream().anyMatch(reservation -> {
                        if (reservation.sourceLocation == null
                                        || reservation.sourceLocation.getLocationType() != LocationType.QC
                                        || reservation.status == ReservationStatus.CANCELLED
                                        || reservation.status == ReservationStatus.RELEASED) {
                                return false;
                        }
                        List<MatFlowTransferOrder> routeTransfers = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId());
                        return routeTransfers.stream().noneMatch(transfer -> transfer != null
                                        && transfer.status != TransferStatus.CANCELLED
                                        && transfer.fromLocation != null
                                        && transfer.fromLocation.getId().equals(reservation.sourceLocation.getId()));
                });

                boolean receivedAtQc = reservations.stream().anyMatch(reservation -> transferRepository
                                .findByReservation_IdOrderByRouteSequenceNoAscCreatedAtAsc(reservation.getId()).stream()
                                .anyMatch(transfer -> transfer != null
                                                && transfer.toLocation != null
                                                && transfer.toLocation.getLocationType() == LocationType.QC
                                                && transfer.status == TransferStatus.RECEIVED));

                boolean purchasedPhysicalReceiptAwaitingQc = requisitionIndents.stream()
                                .flatMap(indent -> indentLineRepository
                                                .findByIndent_IdOrderByCreatedAtAsc(indent.getId()).stream())
                                .filter(indentLine -> indentLine.requisitionLine != null
                                                && line.getId().equals(indentLine.requisitionLine.getId()))
                                .flatMap(indentLine -> purchaseOrderLineRepository
                                                .findByIndentLine_Id(indentLine.getId()).stream())
                                .anyMatch(poLine -> zero(poLine.receivedQty).compareTo(BigDecimal.ZERO) > 0
                                                && poLine.indentLine != null
                                                && zero(poLine.indentLine.receivedQty)
                                                                .compareTo(zero(poLine.receivedQty)) < 0);

                if (qcCustody || receivedAtQc || purchasedPhysicalReceiptAwaitingQc) {
                        return RequisitionLineStatus.QC_PENDING;
                }

                List<MatFlowIndentLine> indentLines = requisitionIndents.stream()
                                .flatMap(indent -> indentLineRepository
                                                .findByIndent_IdOrderByCreatedAtAsc(indent.getId()).stream())
                                .filter(indentLine -> indentLine.requisitionLine != null
                                                && line.getId().equals(indentLine.requisitionLine.getId()))
                                .toList();

                boolean ordered = indentLines.stream()
                                .anyMatch(indentLine -> zero(indentLine.orderedQty).compareTo(BigDecimal.ZERO) > 0);
                if (shortage.compareTo(BigDecimal.ZERO) > 0 && ordered) {
                        return RequisitionLineStatus.ORDERED;
                }

                if (shortage.compareTo(BigDecimal.ZERO) > 0 && !indentLines.isEmpty()) {
                        return RequisitionLineStatus.INDENT_CREATED;
                }

                if (shortage.compareTo(BigDecimal.ZERO) > 0) {
                        return RequisitionLineStatus.SHORTAGE_IDENTIFIED;
                }

                if (reserved.compareTo(requested) >= 0 && requested.compareTo(BigDecimal.ZERO) > 0) {
                        return RequisitionLineStatus.RESERVED;
                }

                if (reserved.compareTo(BigDecimal.ZERO) > 0) {
                        return RequisitionLineStatus.PARTIALLY_RESERVED;
                }

                return RequisitionLineStatus.PENDING_STORE_REVIEW;
        }

        private boolean isStoreQueueStatus(RequisitionStatus status) {
                if (status == null) {
                        return false;
                }

                return switch (status.name()) {
                        case "SUBMITTED", "SUBMITTED_TO_STORE", "STORE_REVIEW_IN_PROGRESS",
                                        "PARTIALLY_RESERVED", "SHORTAGE_PENDING", "READY_TO_ISSUE",
                                        "PARTIALLY_ISSUED" ->
                                true;
                        default -> false;
                };
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

                        accessService.requireProductionOwnership(requisition.requestedBy);
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
                                                        : "NOT_ISSUE_READY",

                                        false,
                                        false,
                                        reservation.firstDestinationLocation != null
                                                        && (reservation.firstDestinationLocation
                                                                        .getLocationType() == LocationType.PROCESSING
                                                                        || reservation.firstDestinationLocation
                                                                                        .getLocationType() == LocationType.EXTERNAL_PROCESSOR),
                                        null,
                                        reservation.firstDestinationLocation == null
                                                        ? null
                                                        : reservation.firstDestinationLocation.getLocationCode());
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
