package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterial;
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
import java.util.Locale;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
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

        private final MatFlowMaterialRequisitionRepository requisitionRepository;
        private final MatFlowAuditService auditService;
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

        @Transactional(readOnly = true)
        public List<RequisitionResponse> listRequisitions() {

                accessService.requireRead();

                return requisitionRepository
                                .findAllByOrderByUpdatedAtDesc()
                                .stream()
                                .filter(requisition -> {
                                        if (requisition.projectDrawing == null) {
                                                return false;
                                        }

                                        String plantCode = clean(
                                                        requisition.projectDrawing
                                                                        .getPlantCode());

                                        return plantCode != null &&
                                                        accessService.canAccessPlant(
                                                                        plantCode);
                                })
                                .map(this::toRequisitionResponse)
                                .toList();
        }

        @Transactional(readOnly = true)
        public RequisitionResponse getRequisition(
                        UUID id) {
                accessService.requireRead();

                return toRequisitionResponse(
                                requireRequisition(id));
        }

        @Transactional
        public RequisitionResponse createRequisition(
                        RequisitionCreateRequest request) {
                accessService.requireProductionRequest();

                validateCreateRequest(request);

                MatFlowProjectDrawing project = projectRepository
                                .findById(
                                                request.projectDrawingId())
                                .orElseThrow(() -> notFound(
                                                "Project drawing not found"));

                String projectPlantCode = requirePlantCode(
                                project.getPlantCode(),
                                "Project drawing " +
                                                project.getProjectCode());

                /*
                 * Access is validated against the project/demand plant.
                 * Do not derive access from a new requisition object.
                 */
                accessService.requirePlantAccess(
                                projectPlantCode);

                if (!project.isActive()) {
                        throw badRequest(
                                        "Inactive project drawing cannot be requisitioned");
                }

                MatFlowBom bom = bomRepository
                                .findById(
                                                request.bomId())
                                .orElseThrow(() -> notFound(
                                                "Approved BOM not found"));

                if (bom.getProjectDrawing() == null) {
                        throw conflict(
                                        "Selected BOM has no project drawing");
                }

                if (!bom.getProjectDrawing()
                                .getId()
                                .equals(
                                                project.getId())) {

                        throw badRequest(
                                        "Selected BOM does not belong to the selected project drawing");
                }

                String bomPlantCode = requirePlantCode(
                                bom.getProjectDrawing()
                                                .getPlantCode(),
                                "Operational BOM " +
                                                bom.getBomNumber());

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

                /*
                 * Load and validate the selected destination.
                 */
                MatFlowLocation destination = requireLocation(
                                request.destinationLocationId());

                String destinationPlantCode = requirePlantCode(
                                destination.plantCode,
                                "Production destination " +
                                                destination.locationCode);

                if (!projectPlantCode.equals(
                                destinationPlantCode)) {

                        throw badRequest(
                                        "Production destination plant " +
                                                        destinationPlantCode +
                                                        " does not match the BOM plant " +
                                                        projectPlantCode);
                }

                if (destination.locationType != LocationType.PRODUCTION) {

                        throw badRequest(
                                        "Requisition destination must be a Production location");
                }

                if (!destination.active) {
                        throw badRequest(
                                        "Selected Production destination is inactive");
                }

                String actor = accessService.actor();

                MatFlowMaterialRequisition requisition = new MatFlowMaterialRequisition();

                requisition.requisitionNumber = generateNumber("MFR");

                requisition.projectDrawing = project;

                requisition.bom = bom;

                requisition.destinationLocation = destination;

                requisition.status = RequisitionStatus.DRAFT;

                requisition.requestedBy = actor;

                requisition.requestedAt = LocalDateTime.now();

                requisition.remarks = clean(request.remarks());

                requisition.setCreatedBy(actor);
                requisition.setUpdatedBy(actor);

                requisition = requisitionRepository.save(
                                requisition);

                int lineNo = 10;

                for (RequisitionLineRequest lineRequest : request.lines()) {
                        MatFlowBomLine bomLine = bomLineRepository
                                        .findByIdAndBom_Id(
                                                        lineRequest.bomLineId(),
                                                        bom.getId())
                                        .orElseThrow(() -> badRequest(
                                                        "BOM line does not belong to the selected BOM"));

                        BigDecimal requestedQty = positive(
                                        lineRequest.requestedQty(),
                                        "Requested quantity");

                        BigDecimal alreadyRequested = requisitionLineRepository
                                        .findByBomLine_Id(
                                                        bomLine.getId())
                                        .stream()
                                        .filter(existing -> existing.requisition.status != RequisitionStatus.CANCELLED)
                                        .map(existing -> existing.requestedQty)
                                        .reduce(
                                                        BigDecimal.ZERO,
                                                        BigDecimal::add);

                        if (alreadyRequested
                                        .add(requestedQty)
                                        .compareTo(
                                                        bomLine
                                                                        .getNetRequiredQty()) > 0) {
                                throw conflict(
                                                "Requested quantity exceeds approved BOM quantity for material " +
                                                                bomLine
                                                                                .getMaterialCodeSnapshot());
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
                        line.setCreatedBy(actor);
                        line.setUpdatedBy(actor);

                        requisitionLineRepository.save(line);

                        lineNo += 10;
                }

                return toRequisitionResponse(
                                requisition);
        }

        @Transactional
        public RequisitionResponse submitRequisition(
                        UUID id,
                        RequisitionActionRequest request) {
                accessService.requireProductionRequest();

                MatFlowMaterialRequisition requisition = requireRequisition(id);

                if (requisition.status != RequisitionStatus.DRAFT) {
                        throw conflict(
                                        "Only a draft requisition can be submitted");
                }

                assertVersion(
                                request == null
                                                ? null
                                                : request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                id);

                if (lines.isEmpty()) {
                        throw badRequest(
                                        "Requisition requires at least one material line");
                }

                String actor = accessService.actor();

                requisition.status = RequisitionStatus.SUBMITTED;

                requisition.submittedBy = actor;
                requisition.submittedAt = LocalDateTime.now();

                if (request != null &&
                                clean(request.remarks()) != null) {
                        requisition.remarks = clean(request.remarks());
                }

                requisition.setUpdatedBy(actor);

                requisitionRepository.save(
                                requisition);

                return toRequisitionResponse(
                                requisition);
        }

        @Transactional
        public PlanningResponse planRequisition(
                        UUID id,
                        PlanningRequest request) {
                accessService.requireMaterialPlanning();

                MatFlowMaterialRequisition requisition = requireRequisition(id);

                if (requisition.status != RequisitionStatus.SUBMITTED) {
                        throw conflict(
                                        "Only a submitted requisition can be planned");
                }

                assertVersion(
                                request == null
                                                ? null
                                                : request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                List<UUID> preferredSourceIds = request == null ||
                                request.preferredSourceLocationIds() == null
                                                ? List.of()
                                                : request.preferredSourceLocationIds();

                validatePreferredSources(
                                preferredSourceIds);

                Map<UUID, Integer> preferredRank = new LinkedHashMap<>();

                IntStream
                                .range(
                                                0,
                                                preferredSourceIds.size())
                                .forEach(index -> preferredRank.put(
                                                preferredSourceIds
                                                                .get(index),
                                                index));

                String actor = accessService.actor();

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId());

                Map<UUID, MatFlowIndent> indentByDeliveryLocation = new LinkedHashMap<>();

                boolean hasShortage = false;

                for (MatFlowRequisitionLine line : lines) {
                        List<MatFlowBomRouteStep> route = routingService.routeForLine(
                                        line.bomLine.getId());

                        validateDestination(
                                        requisition.destinationLocation,
                                        route);

                        MatFlowLocation firstDestination = route.isEmpty()
                                        ? requisition.destinationLocation
                                        : route.get(0).location;

                        BigDecimal remaining = line.requestedQty;

                        List<MatFlowStockBalance> candidates = stockRepository.findPlanningCandidates(
                                        line.material.getId(),
                                        accessService.allowedPlants(),
                                        EnumSet.of(
                                                        LocationType.STORE,
                                                        LocationType.PROCESSING,
                                                        LocationType.EXTERNAL_PROCESSOR));

                        Comparator<MatFlowStockBalance> candidateOrder = Comparator
                                        .comparingInt(
                                                        (MatFlowStockBalance balance) -> preferredRank.getOrDefault(
                                                                        balance.location.getId(),
                                                                        Integer.MAX_VALUE))
                                        .thenComparingInt(
                                                        (MatFlowStockBalance balance) -> balance.location.plantCode
                                                                        .equalsIgnoreCase(
                                                                                        firstDestination.plantCode)
                                                                                                        ? 0
                                                                                                        : 1)
                                        .thenComparing(
                                                        (MatFlowStockBalance balance) -> balance.availableQty(),

                                                        Comparator.reverseOrder())
                                        .thenComparing(
                                                        (MatFlowStockBalance balance) -> balance.location.locationCode,

                                                        Comparator.nullsLast(
                                                                        String.CASE_INSENSITIVE_ORDER));

                        candidates.sort(candidateOrder);

                        BigDecimal totalReserved = BigDecimal.ZERO;

                        for (MatFlowStockBalance candidate : candidates) {
                                if (remaining.compareTo(
                                                BigDecimal.ZERO) <= 0) {
                                        break;
                                }

                                MatFlowStockBalance locked = stockRepository
                                                .lockBalance(
                                                                line.material
                                                                                .getId(),
                                                                candidate.location
                                                                                .getId())
                                                .orElse(null);

                                if (locked == null) {
                                        continue;
                                }

                                BigDecimal available = locked.availableQty();

                                if (available.compareTo(
                                                BigDecimal.ZERO) <= 0) {
                                        continue;
                                }

                                BigDecimal allocated = available.min(remaining)
                                                .setScale(
                                                                3,
                                                                RoundingMode.HALF_UP);

                                locked.reservedQty = locked.reservedQty
                                                .add(allocated)
                                                .setScale(
                                                                3,
                                                                RoundingMode.HALF_UP);

                                locked.setUpdatedBy(actor);

                                locked = stockRepository.save(locked);

                                MatFlowReservation reservation = new MatFlowReservation();

                                reservation.requisitionLine = line;

                                reservation.material = line.material;

                                reservation.sourceLocation = locked.location;

                                reservation.firstDestinationLocation = firstDestination;

                                reservation.demandPlantCode = requisition.destinationLocation.plantCode;

                                reservation.reservedQty = allocated;

                                reservation.status = ReservationStatus.ACTIVE;

                                reservation.routeSnapshotJson = routeSnapshot(route);

                                reservation.setCreatedBy(actor);
                                reservation.setUpdatedBy(actor);

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

                        line.shortageQty = remaining.max(
                                        BigDecimal.ZERO).setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);

                        line.setUpdatedBy(actor);

                        requisitionLineRepository.save(line);

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
                                indentLine.setCreatedBy(actor);
                                indentLine.setUpdatedBy(actor);

                                indentLineRepository.save(
                                                indentLine);
                        }
                }

                requisition.status = hasShortage
                                ? RequisitionStatus.SHORTAGE_PENDING
                                : RequisitionStatus.PLANNED;

                requisition.plannedBy = actor;
                requisition.plannedAt = LocalDateTime.now();

                if (request != null &&
                                clean(request.remarks()) != null) {
                        requisition.remarks = clean(request.remarks());
                }

                requisition.setUpdatedBy(actor);

                requisition = requisitionRepository.save(
                                requisition);

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "PLANNED",
                                requisition.destinationLocation.plantCode,
                                requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber",
                                                requisition.requisitionNumber,

                                                "status",
                                                requisition.status,

                                                "reservedLineCount",
                                                lines.stream()
                                                                .filter(line -> line.reservedQty.compareTo(
                                                                                BigDecimal.ZERO) > 0)
                                                                .count(),

                                                "shortageLineCount",
                                                lines.stream()
                                                                .filter(line -> line.shortageQty.compareTo(
                                                                                BigDecimal.ZERO) > 0)
                                                                .count()));

                return new PlanningResponse(
                                toRequisitionResponse(
                                                requisition),
                                reservationRepository
                                                .findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
                                                                id)
                                                .stream()
                                                .map(this::toReservationResponse)
                                                .toList(),
                                indentRepository
                                                .findByRequisition_IdOrderByCreatedAtAsc(
                                                                id)
                                                .stream()
                                                .map(this::toIndentResponse)
                                                .toList(),
                                transferRepository
                                                .findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
                                                                id)
                                                .stream()
                                                .map(this::toTransferResponse)
                                                .toList());
        }

        private void createTransferChain(
                        MatFlowMaterialRequisition requisition,
                        MatFlowReservation reservation,
                        List<MatFlowBomRouteStep> route,
                        BigDecimal quantity,
                        String actor) {
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
                int sequence = 10;

                for (int index = 0; index < destinations.size(); index++) {
                        MatFlowLocation next = destinations.get(index);

                        if (current.getId()
                                        .equals(next.getId())) {
                                current = next;
                                continue;
                        }

                        MatFlowTransferOrder transfer = new MatFlowTransferOrder();

                        transfer.transferNumber = generateNumber("MFT");

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

                        transfer.setCreatedBy(actor);
                        transfer.setUpdatedBy(actor);

                        transfer = transferRepository.save(
                                        transfer);

                        MatFlowTransferLine transferLine = new MatFlowTransferLine();

                        transferLine.transferOrder = transfer;

                        transferLine.material = reservation.material;

                        transferLine.routeStepId = route.isEmpty()
                                        ? null
                                        : route.get(index)
                                                        .getId();

                        transferLine.plannedQty = quantity;

                        transferLine.dispatchedQty = BigDecimal.ZERO;

                        transferLine.receivedQty = BigDecimal.ZERO;

                        transferLine.uom = reservation.material
                                        .getUom();

                        transferLine.setCreatedBy(actor);
                        transferLine.setUpdatedBy(actor);

                        transferLineRepository.save(
                                        transferLine);

                        predecessorId = transfer.getId();

                        current = next;
                        sequence += 10;
                }
        }

        private TransferPurpose determinePurpose(
                        MatFlowLocation from,
                        MatFlowLocation to) {
                if (!from.plantCode.equalsIgnoreCase(
                                to.plantCode)) {
                        return TransferPurpose.INTER_PLANT;
                }

                if (to.locationType == LocationType.QC) {
                        return TransferPurpose.QC_TRANSFER;
                }

                boolean fromProcessing = from.locationType == LocationType.PROCESSING ||
                                from.locationType == LocationType.EXTERNAL_PROCESSOR;

                boolean toProcessing = to.locationType == LocationType.PROCESSING ||
                                to.locationType == LocationType.EXTERNAL_PROCESSOR;

                if (fromProcessing &&
                                toProcessing) {
                        return TransferPurpose.PROCESSING_TO_PROCESSING;
                }

                if (fromProcessing &&
                                to.locationType == LocationType.PRODUCTION) {
                        return TransferPurpose.PROCESSING_TO_PRODUCTION;
                }

                if (toProcessing) {
                        return TransferPurpose.STORE_TO_PROCESSING;
                }

                return TransferPurpose.STORE_TO_PRODUCTION;
        }

        private MatFlowIndent createIndent(
                        MatFlowMaterialRequisition requisition,
                        MatFlowLocation deliveryLocation,
                        PlanningRequest request,
                        String actor) {
                MatFlowIndent indent = new MatFlowIndent();

                indent.indentNumber = generateNumber("MFI");

                indent.requisition = requisition;

                indent.projectDrawing = requisition.projectDrawing;

                indent.bom = requisition.bom;

                indent.deliverToLocation = deliveryLocation;

                indent.status = IndentStatus.AUTO_CREATED;

                indent.autoGenerated = true;

                indent.remarks = request == null
                                ? "Automatically created from shortage"
                                : clean(request.remarks());

                indent.setCreatedBy(actor);
                indent.setUpdatedBy(actor);

                return indentRepository.save(indent);
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

                ledger.reservedChange = quantity;

                ledger.blockedChange = BigDecimal.ZERO;

                ledger.inTransitChange = BigDecimal.ZERO;

                ledger.onHandAfter = balance.onHandQty;

                ledger.reservedAfter = balance.reservedQty;

                ledger.blockedAfter = balance.blockedQty;

                ledger.inTransitAfter = balance.inTransitQty;
                ledger.referenceType = "MATFLOW_RESERVATION";

                ledger.referenceId = reservation.getId();

                ledger.referenceNumber = requisition.requisitionNumber;

                ledger.projectCode = requisition.projectDrawing
                                .getProjectCode();

                ledger.drawingNo = requisition.projectDrawing
                                .getDrawingNo();

                ledger.remarks = "Reserved against material requisition";

                ledger.actor = actor;

                ledgerRepository.save(ledger);
        }

        private void validateDestination(
                        MatFlowLocation requisitionDestination,
                        List<MatFlowBomRouteStep> route) {
                if (route.isEmpty()) {
                        return;
                }

                MatFlowBomRouteStep finalStep = route.get(route.size() - 1);

                if (finalStep.location
                                .getId()
                                .equals(
                                                requisitionDestination
                                                                .getId())) {
                        return;
                }

                throw conflict(
                                "Requisition production destination does not match the final BOM route location");
        }

        private void validatePreferredSources(
                        List<UUID> locationIds) {
                for (UUID id : locationIds) {
                        MatFlowLocation location = requireLocation(id);

                        if (!location.supportsStock) {
                                throw badRequest(
                                                "Preferred source does not support stock: " +
                                                                location.locationCode);
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
                                        "Approved BOM is required");
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

                String projectPlantCode = requirePlantCode(
                                requisition.projectDrawing
                                                .getPlantCode(),
                                "Material requisition project");

                accessService.requirePlantAccess(
                                projectPlantCode);

                if (requisition.destinationLocation == null) {
                        throw conflict(
                                        "Material requisition has no destination location");
                }

                String destinationPlantCode = requirePlantCode(
                                requisition.destinationLocation.plantCode,
                                "Material requisition destination");

                if (!projectPlantCode.equals(
                                destinationPlantCode)) {

                        throw conflict(
                                        "Material requisition destination plant does not match its project plant");
                }

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

                String locationDescription = clean(
                                location.locationCode);

                if (locationDescription == null) {
                        locationDescription = String.valueOf(
                                        location.getId());
                }

                String plantCode = requirePlantCode(
                                location.plantCode,
                                "Location " +
                                                locationDescription);

                accessService.requirePlantAccess(
                                plantCode);

                if (!location.active) {
                        throw badRequest(
                                        "Inactive location cannot be selected: " +
                                                        locationDescription);
                }

                return location;
        }

        private RequisitionResponse toRequisitionResponse(
                        MatFlowMaterialRequisition requisition) {
                List<RequisitionLineResponse> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId())
                                .stream()
                                .map(line -> {
                                        MatFlowMaterial issuedMaterial = line.issuedMaterial;

                                        String responseUom = issuedMaterial == null
                                                        ? line.material.getUom()
                                                        : issuedMaterial.getUom();

                                        return new RequisitionLineResponse(
                                                        line.getId(),
                                                        line.lineNo,
                                                        line.bomLine.getId(),

                                                        line.material.getId(),
                                                        line.material
                                                                        .getMaterialCode(),
                                                        line.material
                                                                        .getMaterialName(),

                                                        issuedMaterial == null
                                                                        ? null
                                                                        : issuedMaterial.getId(),

                                                        issuedMaterial == null
                                                                        ? null
                                                                        : issuedMaterial
                                                                                        .getMaterialCode(),

                                                        issuedMaterial == null
                                                                        ? null
                                                                        : issuedMaterial
                                                                                        .getMaterialName(),

                                                        responseUom,

                                                        line.bomLine
                                                                        .getNetRequiredQty(),

                                                        line.requestedQty,
                                                        line.reservedQty,
                                                        line.shortageQty,
                                                        line.issuedQty,
                                                        line.consumedQty,
                                                        line.returnedQty,

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

                                requisition.bom.getId(),
                                requisition.bom.getBomNumber(),
                                requisition.bom.getRevisionNo(),

                                requisition.destinationLocation
                                                .getId(),

                                requisition.destinationLocation.locationCode,

                                requisition.destinationLocation.locationName,

                                requisition.destinationLocation.plantCode,

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

        private IndentResponse toIndentResponse(
                        MatFlowIndent indent) {
                List<IndentLineResponse> lines = indentLineRepository
                                .findByIndent_IdOrderByCreatedAtAsc(
                                                indent.getId())
                                .stream()
                                .map(line -> new IndentLineResponse(
                                                line.getId(),
                                                line.material
                                                                .getMaterialCode(),
                                                line.material
                                                                .getMaterialName(),
                                                line.requiredQty,
                                                line.orderedQty,
                                                line.receivedQty,
                                                line.uom))
                                .toList();

                return new IndentResponse(
                                indent.getId(),
                                indent.indentNumber,
                                indent.deliverToLocation
                                                .getId(),
                                indent.deliverToLocation.locationCode,
                                indent.deliverToLocation.plantCode,
                                indent.status,
                                indent.autoGenerated,
                                indent.getRowVersion(),
                                lines);
        }

        private TransferResponse toTransferResponse(
                        MatFlowTransferOrder transfer) {
                MatFlowTransferLine line = transferLineRepository
                                .findByTransferOrder_IdOrderByCreatedAtAsc(
                                                transfer.getId())
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> conflict(
                                                "Transfer order has no material line"));

                return new TransferResponse(
                                transfer.getId(),
                                transfer.transferNumber,
                                transfer.reservation.getId(),

                                transfer.fromLocation.getId(),
                                transfer.fromLocation.locationCode,
                                transfer.fromLocation.plantCode,

                                transfer.toLocation.getId(),
                                transfer.toLocation.locationCode,
                                transfer.toLocation.plantCode,

                                transfer.routeSequenceNo,
                                transfer.predecessorTransferId,

                                transfer.purpose,
                                transfer.status,

                                line.material.getMaterialCode(),
                                line.plannedQty,
                                line.dispatchedQty,
                                line.receivedQty,
                                line.uom,

                                transfer.getRowVersion());
        }

        private String routeSnapshot(
                        List<MatFlowBomRouteStep> route) {
                try {
                        return objectMapper
                                        .writeValueAsString(
                                                        route.stream()
                                                                        .map(step -> Map.of(
                                                                                        "stepId",
                                                                                        step.getId(),
                                                                                        "sequenceNo",
                                                                                        step.sequenceNo,
                                                                                        "stepType",
                                                                                        step.stepType,
                                                                                        "locationId",
                                                                                        step.location
                                                                                                        .getId(),
                                                                                        "locationCode",
                                                                                        step.location.locationCode,
                                                                                        "plantCode",
                                                                                        step.location.plantCode,
                                                                                        "processCode",
                                                                                        step.processCode == null
                                                                                                        ? ""
                                                                                                        : step.processCode))
                                                                        .toList());
                } catch (JsonProcessingException ex) {
                        throw new IllegalStateException(
                                        "Unable to capture route snapshot",
                                        ex);
                }
        }

        private String generateNumber(
                        String prefix) {
                return prefix +
                                "-" +
                                LocalDate.now().getYear() +
                                "-" +
                                UUID.randomUUID()
                                                .toString()
                                                .replace("-", "")
                                                .substring(0, 8)
                                                .toUpperCase();
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

        private String requirePlantCode(
                        String value,
                        String source) {

                String normalized = value == null
                                ? null
                                : value.trim()
                                                .toUpperCase(
                                                                Locale.ROOT);

                if (normalized == null ||
                                normalized.isBlank()) {

                        throw conflict(
                                        source +
                                                        " does not contain a valid plant code");
                }

                return normalized;
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
                                                        " was modified by another user. Refresh and retry.");
                }
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