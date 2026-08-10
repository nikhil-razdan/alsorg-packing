package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobStartRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;

import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.*;
import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Production execution boundary: preprocessing/processing jobs, explicit
 * Production start/completion and material consumption.
 */
@Service
public class MatFlowProductionService {

        private final ProcessingModule processing;
        private final ConsumptionModule consumption;
        private final MatFlowMaterialRequisitionRepository requisitionRepository;
        private final MatFlowRequisitionLineRepository requisitionLineRepository;
        private final MatFlowAccessService accessService;
        private final MatFlowAuditService auditService;

        public MatFlowProductionService(
                        MatFlowProcessingJobRepository jobRepository,
                        MatFlowReservationRepository reservationRepository,
                        MatFlowBomRouteStepRepository routeRepository,
                        MatFlowMaterialRepository materialRepository,
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowTransferOrderRepository transferRepository,
                        MatFlowTransferLineRepository transferLineRepository,
                        MatFlowRequisitionLineRepository requisitionLineRepository,
                        MatFlowMaterialRequisitionRepository requisitionRepository,
                        MatFlowIndentRepository indentRepository,
                        MatFlowIndentLineRepository indentLineRepository,
                        MatFlowProductionConsumptionRepository consumptionRepository,
                        MatFlowProductionConsumptionLineRepository consumptionLineRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService,
                        MatFlowRequisitionService requisitionService) {

                this.requisitionRepository = requisitionRepository;
                this.requisitionLineRepository = requisitionLineRepository;
                this.accessService = accessService;
                this.auditService = auditService;

                this.processing = new ProcessingModule(
                                jobRepository,
                                reservationRepository,
                                routeRepository,
                                materialRepository,
                                stockRepository,
                                ledgerRepository,
                                transferRepository,
                                transferLineRepository,
                                requisitionLineRepository,
                                indentRepository,
                                indentLineRepository,
                                accessService,
                                auditService,
                                requisitionService);

                this.consumption = new ConsumptionModule(
                                consumptionRepository,
                                consumptionLineRepository,
                                requisitionRepository,
                                requisitionLineRepository,
                                locationRepository,
                                stockRepository,
                                ledgerRepository,
                                accessService,
                                auditService,
                                requisitionService);
        }

        @Transactional(readOnly = true)
        public List<ProcessingJobResponse> listProcessingJobs() {
                return processing.list();
        }

        @Transactional
        public ProcessingJobResponse createProcessingJob(ProcessingJobCreateRequest request) {
                return processing.create(request);
        }

        @Transactional
        public ProcessingJobResponse startProcessingJob(UUID id, ProcessingJobStartRequest request) {
                return processing.start(id, request);
        }

        @Transactional
        public ProcessingJobResponse completeProcessingJob(UUID id, ProcessingJobCompleteRequest request) {
                return processing.complete(id, request);
        }

        @Transactional
        public void startProduction(UUID requisitionId, RequisitionActionRequest request) {
                accessService.requireProductionRequest();

                if (requisitionId == null) {
                        throw badRequest("Requisition ID is required");
                }

                MatFlowMaterialRequisition requisition = requisitionRepository
                                .lockById(requisitionId)
                                .orElseThrow(() -> notFound("Requisition not found"));

                /*
                 * lockById(...) can resolve to an already-managed Hibernate proxy.
                 * MatFlow entities expose public JPA backing fields, so workflow-critical
                 * associations must be unwrapped before direct field access.
                 */
                requisition = hydrateProductionRequisition(
                                requisition,
                                "Production start");

                accessService.requirePlantAccess(
                                requisition.destinationLocation.getPlantCode());

                assertVersion(
                                request == null ? null : request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                if (requisition.status != RequisitionStatus.ISSUED_TO_PRODUCTION) {
                        throw conflict(
                                        "Production can start only after the complete requisition is issued to Production");
                }

                String actor = accessService.actor();

                requisition.status = RequisitionStatus.PRODUCTION_STARTED;

                if (request != null && clean(request.remarks()) != null) {
                        requisition.remarks = clean(request.remarks());
                }

                requisition.setUpdatedBy(actor);
                requisitionRepository.save(requisition);

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "PRODUCTION_STARTED",
                                requisition.destinationLocation.getPlantCode(),
                                requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber",
                                                requisition.requisitionNumber));
        }

        @Transactional(readOnly = true)
        public List<ConsumptionResponse> listConsumptions() {
                return consumption.list();
        }

        @Transactional
        public ConsumptionResponse consume(ConsumptionRequest request) {
                return consumption.consume(request);
        }

        @Transactional
        public void completeProduction(UUID requisitionId, RequisitionActionRequest request) {
                accessService.requireProductionRequest();

                if (requisitionId == null) {
                        throw badRequest("Requisition ID is required");
                }

                MatFlowMaterialRequisition requisition = requisitionRepository
                                .lockById(requisitionId)
                                .orElseThrow(() -> notFound("Requisition not found"));

                requisition = hydrateProductionRequisition(
                                requisition,
                                "Production completion");

                accessService.requirePlantAccess(
                                requisition.destinationLocation.getPlantCode());

                assertVersion(
                                request == null ? null : request.rowVersion(),
                                requisition.getRowVersion(),
                                "Requisition");

                if (requisition.status != RequisitionStatus.PRODUCTION_STARTED) {
                        throw conflict(
                                        "Only an in-progress Production requisition can be completed");
                }

                List<MatFlowRequisitionLine> lines = requisitionLineRepository
                                .findByRequisition_IdOrderByLineNoAsc(
                                                requisition.getId())
                                .stream()
                                .map(line -> (MatFlowRequisitionLine) Hibernate.unproxy(line))
                                .toList();

                if (lines.isEmpty()) {
                        throw conflict("Requisition has no material lines");
                }

                boolean fullyAccounted = lines.stream().allMatch(line -> {
                        BigDecimal requested = zero(line.requestedQty);
                        BigDecimal issued = zero(line.issuedQty);
                        BigDecimal accounted = zero(line.consumedQty)
                                        .add(zero(line.returnedQty));

                        return issued.compareTo(requested) >= 0 &&
                                        accounted.compareTo(issued) >= 0;
                });

                if (!fullyAccounted) {
                        throw conflict(
                                        "Production cannot be completed until all requested material is issued and every issued quantity is consumed or returned");
                }

                String actor = accessService.actor();

                requisition.status = RequisitionStatus.PRODUCTION_COMPLETED;

                if (request != null && clean(request.remarks()) != null) {
                        requisition.remarks = clean(request.remarks());
                }

                requisition.setUpdatedBy(actor);
                requisitionRepository.save(requisition);

                auditService.record(
                                "REQUISITION",
                                requisition.getId(),
                                "PRODUCTION_COMPLETED",
                                requisition.destinationLocation.getPlantCode(),
                                requisition.projectDrawing.getProjectCode(),
                                requisition.projectDrawing.getDrawingNo(),
                                auditService.details(
                                                "requisitionNumber",
                                                requisition.requisitionNumber));
        }

        /**
         * Returns the real managed requisition aggregate before Production lifecycle
         * code reads public association fields. This does not change workflow state;
         * it only prevents a Hibernate proxy from making valid foreign-key-backed
         * associations appear null.
         */
        private MatFlowMaterialRequisition hydrateProductionRequisition(
                        MatFlowMaterialRequisition raw,
                        String operation) {

                if (raw == null || raw.getId() == null) {
                        throw conflict(
                                        (operation == null ? "Production" : operation) +
                                                        " requires a valid requisition");
                }

                MatFlowMaterialRequisition requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(raw);

                if (requisition.destinationLocation != null) {
                        requisition.destinationLocation = (MatFlowLocation) Hibernate.unproxy(
                                        requisition.destinationLocation);
                }

                if (requisition.projectDrawing != null) {
                        requisition.projectDrawing = (MatFlowProjectDrawing) Hibernate.unproxy(
                                        requisition.projectDrawing);
                }

                if (requisition.bom != null) {
                        requisition.bom = (MatFlowBom) Hibernate.unproxy(
                                        requisition.bom);
                }

                if (requisition.destinationLocation == null) {
                        throw conflict(
                                        (operation == null ? "Production" : operation) +
                                                        " requisition has no Production destination");
                }

                if (requisition.projectDrawing == null) {
                        throw conflict(
                                        (operation == null ? "Production" : operation) +
                                                        " requisition has no Project/Drawing");
                }

                if (requisition.destinationLocation.getLocationType() != LocationType.PRODUCTION) {
                        throw conflict(
                                        (operation == null ? "Production" : operation) +
                                                        " requisition destination is not a Production location");
                }

                return requisition;
        }

        private BigDecimal zero(BigDecimal value) {
                return value == null ? BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP)
                                : value.setScale(3, RoundingMode.HALF_UP);
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
                if (value == null)
                        return null;
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

        private static final class ProcessingModule {

                private final MatFlowProcessingJobRepository jobRepository;
                private final MatFlowReservationRepository reservationRepository;
                private final MatFlowBomRouteStepRepository routeRepository;
                private final MatFlowMaterialRepository materialRepository;
                private final MatFlowStockBalanceRepository stockRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowTransferLineRepository transferLineRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowIndentRepository indentRepository;
                private final MatFlowIndentLineRepository indentLineRepository;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;
                private final MatFlowRequisitionService requisitionService;

                ProcessingModule(
                                MatFlowProcessingJobRepository jobRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowBomRouteStepRepository routeRepository,
                                MatFlowMaterialRepository materialRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowTransferLineRepository transferLineRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowIndentRepository indentRepository,
                                MatFlowIndentLineRepository indentLineRepository,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService,
                                MatFlowRequisitionService requisitionService) {
                        this.jobRepository = jobRepository;
                        this.reservationRepository = reservationRepository;
                        this.routeRepository = routeRepository;
                        this.materialRepository = materialRepository;
                        this.stockRepository = stockRepository;
                        this.ledgerRepository = ledgerRepository;
                        this.transferRepository = transferRepository;
                        this.transferLineRepository = transferLineRepository;
                        this.requisitionLineRepository = requisitionLineRepository;
                        this.indentRepository = indentRepository;
                        this.indentLineRepository = indentLineRepository;
                        this.accessService = accessService;
                        this.auditService = auditService;
                        this.requisitionService = requisitionService;
                }

                @Transactional(readOnly = true)
                public List<ProcessingJobResponse> list() {
                        accessService.requireRead();

                        return jobRepository
                                        .findAllByOrderByUpdatedAtDesc()
                                        .stream()
                                        .filter(job -> accessService.canAccessPlant(
                                                        job.location.getPlantCode()))
                                        .map(this::toResponse)
                                        .toList();
                }

                @Transactional
                public ProcessingJobResponse create(
                                ProcessingJobCreateRequest request) {
                        accessService.requireProcessingWrite();

                        if (request == null ||
                                        request.reservationId() == null ||
                                        request.routeStepId() == null) {
                                throw badRequest(
                                                "Reservation and processing route step are required");
                        }

                        MatFlowReservation reservation = reservationRepository
                                        .findById(request.reservationId())
                                        .orElseThrow(() -> notFound(
                                                        "Reservation not found"));

                        MatFlowBomRouteStep routeStep = routeRepository
                                        .findById(request.routeStepId())
                                        .orElseThrow(() -> notFound(
                                                        "Route step not found"));

                        if (routeStep.stepType != MatFlowPlanningTypes.RouteStepType.PROCESSING) {
                                throw badRequest(
                                                "Selected route step is not a processing step");
                        }

                        if (!routeStep.bomLine.getId()
                                        .equals(
                                                        reservation.requisitionLine.bomLine
                                                                        .getId())) {
                                throw conflict(
                                                "Route step does not belong to the reservation BOM line");
                        }

                        accessService.requirePlantAccess(
                                        routeStep.location.getPlantCode());

                        if (jobRepository
                                        .findByReservation_IdAndRouteStep_Id(
                                                        reservation.getId(),
                                                        routeStep.getId())
                                        .isPresent()) {
                                throw conflict(
                                                "A processing job already exists for this reservation and route step");
                        }

                        if (reservation.status != ReservationStatus.ACTIVE) {
                                throw conflict(
                                                "Processing requires an active, not-yet-issued material reservation");
                        }

                        /*
                         * vNext processing semantics:
                         * PROCESSING steps in the approved BOM are permitted QC routing
                         * options, not a mandatory sequence. The QC actor selects at most
                         * one Processing Unit for the inspected lot. Therefore job creation
                         * must validate the exact transfer created by the QC routing gate,
                         * not demand completion of lower-sequence processing options.
                         */
                        boolean inboundSelectedProcessingTransferReceived = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAsc(reservation.getId())
                                        .stream()
                                        .filter(transfer -> transfer != null
                                                        && transfer.toLocation != null
                                                        && routeStep.location != null
                                                        && transfer.toLocation.getId()
                                                                        .equals(routeStep.location.getId())
                                                        && transfer.status == TransferStatus.RECEIVED)
                                        .anyMatch(transfer -> transferLineRepository
                                                        .findFirstByTransferOrder_IdOrderByCreatedAtAsc(
                                                                        transfer.getId())
                                                        .map(line -> routeStep.getId().equals(line.routeStepId))
                                                        .orElse(false));

                        if (!inboundSelectedProcessingTransferReceived) {
                                throw conflict(
                                                "QC has not routed and fully received this reservation at the selected Processing Unit");
                        }

                        MatFlowMaterial outputMaterial = request.outputMaterialId() == null
                                        ? reservation.material
                                        : materialRepository
                                                        .findById(
                                                                        request.outputMaterialId())
                                                        .orElseThrow(() -> notFound(
                                                                        "Output material not found"));

                        if (!reservation.material
                                        .getUom()
                                        .equalsIgnoreCase(
                                                        outputMaterial.getUom())) {
                                throw badRequest(
                                                "Input and output materials must use the same UOM");
                        }

                        BigDecimal plannedQty = positive(
                                        request.plannedInputQty(),
                                        "Planned input quantity");

                        BigDecimal reservationQty = scale(reservation.reservedQty);

                        /*
                         * One ProcessingJob is allowed per reservation + route step. Therefore
                         * a job must process the complete reserved lot at that step; allowing a
                         * smaller planned quantity would strand the remainder with no legal
                         * second job for the same route step.
                         */
                        if (plannedQty.compareTo(reservationQty) != 0) {
                                throw conflict(
                                                "Planned processing quantity must equal the complete reserved quantity of "
                                                                +
                                                                reservationQty);
                        }

                        String actor = accessService.actor();

                        MatFlowProcessingJob job = new MatFlowProcessingJob();

                        job.jobNumber = generateNumber("MFP");

                        job.requisition = reservation.requisitionLine.requisition;

                        job.reservation = reservation;
                        job.routeStep = routeStep;
                        job.location = routeStep.location;
                        job.inputMaterial = reservation.material;
                        job.outputMaterial = outputMaterial;
                        job.plannedInputQty = plannedQty;
                        job.status = ProcessingJobStatus.PENDING;
                        job.remarks = clean(request.remarks());

                        job.setCreatedBy(actor);
                        job.setUpdatedBy(actor);

                        job = jobRepository.save(job);

                        auditService.record(
                                        "PROCESSING_JOB",
                                        job.getId(),
                                        "PROCESSING_JOB_CREATED",
                                        job.location.getPlantCode(),
                                        job.requisition.projectDrawing == null ? null
                                                        : job.requisition.projectDrawing.getProjectCode(),
                                        job.requisition.projectDrawing == null ? null
                                                        : job.requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "jobNumber", job.jobNumber,
                                                        "reservationId", reservation.getId(),
                                                        "routeStepId", routeStep.getId(),
                                                        "processCode", routeStep.processCode,
                                                        "plannedInputQty", plannedQty));

                        requisitionService.refreshState(job.requisition.getId(), actor);
                        return toResponse(job);
                }

                @Transactional
                public ProcessingJobResponse start(
                                UUID id,
                                ProcessingJobStartRequest request) {
                        accessService.requireProcessingWrite();

                        if (request == null) {
                                throw badRequest(
                                                "Processing start request is required");
                        }

                        MatFlowProcessingJob job = requireJob(id);

                        if (job.status != ProcessingJobStatus.PENDING) {
                                throw conflict(
                                                "Only a pending processing job can be started");
                        }

                        assertVersion(
                                        request.rowVersion(),
                                        job.getRowVersion());

                        if (job.reservation.status != ReservationStatus.ACTIVE) {
                                throw conflict(
                                                "Processing requires an active material reservation");
                        }

                        if (!job.reservation.material
                                        .getId()
                                        .equals(
                                                        job.inputMaterial.getId())) {
                                throw conflict(
                                                "Processing input material does not match the active reservation material");
                        }

                        BigDecimal inputQty = positive(
                                        request.actualInputQty(),
                                        "Actual input quantity");

                        if (inputQty.compareTo(
                                        job.plannedInputQty) != 0) {
                                throw conflict(
                                                "Actual input quantity must equal the planned input quantity");
                        }

                        MatFlowStockBalance balance = stockRepository
                                        .lockBalance(
                                                        job.inputMaterial.getId(),
                                                        job.location.getId())
                                        .orElseThrow(() -> conflict(
                                                        "Processing input stock not found"));

                        BigDecimal usableOnHand = balance.onHandQty
                                        .subtract(
                                                        balance.blockedQty);

                        if (usableOnHand.compareTo(
                                        inputQty) < 0) {
                                throw conflict(
                                                "Insufficient usable physical stock for processing");
                        }

                        if (balance.reservedQty
                                        .compareTo(
                                                        inputQty) < 0) {
                                throw conflict(
                                                "Insufficient reserved stock for processing");
                        }

                        String actor = accessService.actor();

                        balance.onHandQty = scale(
                                        balance.onHandQty
                                                        .subtract(inputQty));

                        balance.reservedQty = scale(
                                        balance.reservedQty
                                                        .subtract(inputQty));

                        balance.setUpdatedBy(actor);

                        balance = stockRepository.save(balance);

                        job.actualInputQty = inputQty;

                        job.status = ProcessingJobStatus.IN_PROGRESS;

                        job.startedBy = actor;

                        job.startedAt = LocalDateTime.now();

                        if (clean(request.remarks()) != null) {
                                job.remarks = clean(request.remarks());
                        }

                        job.setUpdatedBy(actor);

                        job = jobRepository.save(job);

                        saveLedger(
                                        balance,
                                        MovementType.PROCESS_CONSUMPTION,
                                        inputQty.negate(),
                                        inputQty.negate(),
                                        job,
                                        request.batchNo(),
                                        actor);

                        auditService.record(
                                        "PROCESSING_JOB",
                                        job.getId(),
                                        "PROCESSING_STARTED",
                                        job.location.getPlantCode(),
                                        job.requisition.projectDrawing == null ? null
                                                        : job.requisition.projectDrawing.getProjectCode(),
                                        job.requisition.projectDrawing == null ? null
                                                        : job.requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "jobNumber", job.jobNumber,
                                                        "actualInputQty", inputQty,
                                                        "batchNo", clean(request.batchNo())));

                        requisitionService.refreshState(job.requisition.getId(), actor);

                        return toResponse(job);
                }

                @Transactional
                public ProcessingJobResponse complete(
                                UUID id,
                                ProcessingJobCompleteRequest request) {
                        accessService.requireProcessingWrite();

                        if (request == null) {
                                throw badRequest(
                                                "Processing completion request is required");
                        }

                        MatFlowProcessingJob job = requireJob(id);

                        if (job.status != ProcessingJobStatus.IN_PROGRESS) {
                                throw conflict(
                                                "Only an in-progress job can be completed");
                        }

                        assertVersion(
                                        request.rowVersion(),
                                        job.getRowVersion());

                        BigDecimal outputQty = nonNegative(
                                        request.outputQty(),
                                        "Output quantity");

                        BigDecimal wastageQty = nonNegative(
                                        request.wastageQty(),
                                        "Wastage quantity");

                        BigDecimal accountedInput = outputQty.add(wastageQty);

                        if (accountedInput.compareTo(
                                        job.actualInputQty) != 0) {
                                throw badRequest(
                                                "Output and wastage quantities must equal actual input quantity");
                        }

                        String actor = accessService.actor();

                        MatFlowStockBalance outputBalance = lockOrCreateBalance(
                                        job.outputMaterial,
                                        job.location,
                                        actor);

                        outputBalance.onHandQty = scale(
                                        outputBalance.onHandQty
                                                        .add(outputQty));

                        outputBalance.reservedQty = scale(
                                        outputBalance.reservedQty
                                                        .add(outputQty));

                        if (outputBalance.reservedQty
                                        .add(
                                                        outputBalance.blockedQty)
                                        .compareTo(
                                                        outputBalance.onHandQty) > 0) {
                                throw conflict(
                                                "Processing output would make reserved and blocked stock exceed physical stock");
                        }

                        outputBalance.setUpdatedBy(actor);

                        outputBalance = stockRepository.save(
                                        outputBalance);

                        job.outputQty = outputQty;

                        job.wastageQty = wastageQty;

                        job.status = ProcessingJobStatus.COMPLETED;

                        job.completedBy = actor;

                        job.completedAt = LocalDateTime.now();

                        if (clean(request.remarks()) != null) {
                                job.remarks = clean(request.remarks());
                        }

                        job.setUpdatedBy(actor);

                        job = jobRepository.save(job);

                        MatFlowReservation reservation = job.reservation;

                        /*
                         * The reservation now represents the processed output
                         * held at the processing location.
                         */
                        reservation.material = job.outputMaterial;

                        reservation.sourceLocation = job.location;

                        reservation.reservedQty = outputQty;

                        reservation.status = outputQty.compareTo(
                                        BigDecimal.ZERO) > 0
                                                        ? ReservationStatus.ACTIVE
                                                        : ReservationStatus.CANCELLED;

                        reservation.setUpdatedBy(actor);

                        reservationRepository.save(
                                        reservation);

                        updateDownstreamTransfers(
                                        reservation,
                                        job.location,
                                        job.outputMaterial,
                                        outputQty,
                                        actor);

                        if (wastageQty.compareTo(
                                        BigDecimal.ZERO) > 0) {
                                registerProcessingShortage(
                                                job,
                                                wastageQty,
                                                actor);
                        }

                        saveLedger(
                                        outputBalance,
                                        MovementType.PROCESS_OUTPUT,
                                        outputQty,
                                        outputQty,
                                        job,
                                        request.batchNo(),
                                        actor);

                        auditService.record(
                                        "PROCESSING_JOB",
                                        job.getId(),
                                        "PROCESSING_COMPLETED",
                                        job.location.getPlantCode(),
                                        job.requisition.projectDrawing
                                                        .getProjectCode(),
                                        job.requisition.projectDrawing
                                                        .getDrawingNo(),
                                        auditService.details(
                                                        "jobNumber",
                                                        job.jobNumber,
                                                        "processCode",
                                                        job.routeStep.processCode,
                                                        "inputMaterial",
                                                        job.inputMaterial.getMaterialCode(),
                                                        "outputMaterial",
                                                        job.outputMaterial.getMaterialCode(),
                                                        "actualInputQty",
                                                        job.actualInputQty,
                                                        "outputQty",
                                                        job.outputQty,
                                                        "wastageQty",
                                                        job.wastageQty));

                        requisitionService.refreshState(job.requisition.getId(), actor);

                        return toResponse(job);
                }

                private void updateDownstreamTransfers(
                                MatFlowReservation reservation,
                                MatFlowLocation currentLocation,
                                MatFlowMaterial outputMaterial,
                                BigDecimal outputQty,
                                String actor) {
                        List<MatFlowTransferOrder> transfers = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAsc(
                                                        reservation.getId());

                        boolean firstFromCurrent = true;

                        for (MatFlowTransferOrder transfer : transfers) {
                                if (transfer.status == TransferStatus.RECEIVED ||
                                                transfer.status == TransferStatus.CANCELLED) {
                                        continue;
                                }

                                MatFlowTransferLine line = transferLineRepository
                                                .findFirstByTransferOrder_IdOrderByCreatedAtAsc(
                                                                transfer.getId())
                                                .orElseThrow(() -> conflict(
                                                                "Downstream transfer line not found"));

                                line.material = outputMaterial;

                                line.plannedQty = outputQty;

                                line.setUpdatedBy(actor);

                                transferLineRepository.save(line);

                                if (firstFromCurrent &&
                                                transfer.fromLocation
                                                                .getId()
                                                                .equals(
                                                                                currentLocation
                                                                                                .getId())) {
                                        transfer.status = outputQty.compareTo(
                                                        BigDecimal.ZERO) > 0
                                                                        ? TransferStatus.READY
                                                                        : TransferStatus.CANCELLED;

                                        firstFromCurrent = false;
                                }

                                transfer.setUpdatedBy(actor);

                                transferRepository.save(transfer);
                        }
                }

                private void registerProcessingShortage(
                                MatFlowProcessingJob job,
                                BigDecimal wastageQty,
                                String actor) {
                        MatFlowRequisitionLine requisitionLine = job.reservation.requisitionLine;

                        requisitionLine.reservedQty = scale(
                                        requisitionLine.reservedQty
                                                        .subtract(wastageQty)
                                                        .max(BigDecimal.ZERO));

                        requisitionLine.shortageQty = scale(
                                        requisitionLine.shortageQty
                                                        .add(wastageQty));

                        requisitionLine.setUpdatedBy(actor);

                        requisitionLineRepository.save(
                                        requisitionLine);

                        MatFlowMaterialRequisition requisition = requisitionLine.requisition;

                        requisitionService.refreshState(
                                        requisition.getId(),
                                        actor);

                        MatFlowIndent indent = new MatFlowIndent();

                        indent.indentNumber = generateNumber("MFI");

                        indent.requisition = requisition;

                        indent.projectDrawing = requisition.projectDrawing;

                        indent.bom = requisition.bom;

                        List<MatFlowBomRouteStep> approvedRoute = routeRepository
                                        .findByBomLine_IdOrderBySequenceNoAsc(requisitionLine.bomLine.getId());

                        MatFlowBomRouteStep qcStep = approvedRoute.stream()
                                        .filter(step -> step != null &&
                                                        step.stepType == RouteStepType.QC &&
                                                        step.location != null)
                                        .findFirst()
                                        .orElseThrow(() -> conflict(
                                                        "Processing-wastage replacement cannot be purchased because the approved BOM line has no QC route step"));

                        indent.deliverToLocation = qcStep.location;

                        indent.status = MatFlowPlanningTypes.IndentStatus.AUTO_CREATED;

                        indent.autoGenerated = true;

                        indent.remarks = "Automatically created for processing wastage; replacement must re-enter through approved QC";

                        indent.setCreatedBy(actor);
                        indent.setUpdatedBy(actor);

                        indent = indentRepository.save(indent);

                        MatFlowIndentLine indentLine = new MatFlowIndentLine();

                        indentLine.indent = indent;
                        indentLine.requisitionLine = requisitionLine;
                        indentLine.material = job.inputMaterial;
                        indentLine.requiredQty = wastageQty;
                        indentLine.orderedQty = BigDecimal.ZERO;
                        indentLine.receivedQty = BigDecimal.ZERO;
                        indentLine.uom = job.inputMaterial.getUom();
                        indentLine.remarks = "Replacement required for processing wastage";

                        indentLine.setCreatedBy(actor);
                        indentLine.setUpdatedBy(actor);

                        indentLineRepository.save(indentLine);
                }

                private MatFlowProcessingJob requireJob(
                                UUID id) {
                        MatFlowProcessingJob job = jobRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "Processing job not found"));

                        accessService.requirePlantAccess(
                                        job.location.getPlantCode());

                        return job;
                }

                private MatFlowStockBalance lockOrCreateBalance(
                                MatFlowMaterial material,
                                MatFlowLocation location,
                                String actor) {
                        MatFlowStockBalance balance = stockRepository
                                        .lockBalance(
                                                        material.getId(),
                                                        location.getId())
                                        .orElse(null);

                        if (balance != null) {
                                return balance;
                        }

                        MatFlowStockBalance created = new MatFlowStockBalance();

                        created.material = material;
                        created.location = location;
                        created.onHandQty = BigDecimal.ZERO;
                        created.reservedQty = BigDecimal.ZERO;
                        created.blockedQty = BigDecimal.ZERO;
                        created.inTransitQty = BigDecimal.ZERO;

                        created.setCreatedBy(actor);
                        created.setUpdatedBy(actor);

                        return stockRepository.saveAndFlush(
                                        created);
                }

                private ProcessingJobResponse toResponse(
                                MatFlowProcessingJob job) {
                        return new ProcessingJobResponse(
                                        job.getId(),
                                        job.jobNumber,
                                        job.requisition.getId(),
                                        job.requisition.requisitionNumber,
                                        job.reservation.getId(),
                                        job.routeStep.getId(),
                                        job.routeStep.processCode,
                                        job.location.getId(),
                                        job.location.getLocationCode(),
                                        job.location.getPlantCode(),
                                        job.inputMaterial.getId(),
                                        job.inputMaterial
                                                        .getMaterialCode(),
                                        job.outputMaterial.getId(),
                                        job.outputMaterial
                                                        .getMaterialCode(),
                                        job.plannedInputQty,
                                        job.actualInputQty,
                                        job.outputQty,
                                        job.wastageQty,
                                        job.status,
                                        job.startedBy,
                                        job.startedAt,
                                        job.completedBy,
                                        job.completedAt,
                                        job.remarks,
                                        job.getRowVersion());
                }

                private void saveLedger(
                                MatFlowStockBalance balance,
                                MovementType type,
                                BigDecimal quantityChange,
                                BigDecimal reservedChange,
                                MatFlowProcessingJob job,
                                String batchNo,
                                String actor) {
                        MatFlowStockLedger ledger = new MatFlowStockLedger();

                        ledger.material = balance.material;
                        ledger.location = balance.location;
                        ledger.movementType = type;

                        ledger.quantityChange = scale(quantityChange);
                        ledger.reservedChange = scale(reservedChange);
                        ledger.blockedChange = BigDecimal.ZERO;
                        ledger.inTransitChange = BigDecimal.ZERO;

                        ledger.onHandAfter = balance.onHandQty;
                        ledger.reservedAfter = balance.reservedQty;
                        ledger.blockedAfter = balance.blockedQty;
                        ledger.inTransitAfter = balance.inTransitQty;

                        ledger.referenceType = "MATFLOW_PROCESSING_JOB";
                        ledger.referenceId = job.getId();
                        ledger.referenceNumber = job.jobNumber;
                        ledger.batchNo = clean(batchNo);
                        ledger.projectCode = job.requisition.projectDrawing
                                        .getProjectCode();
                        ledger.drawingNo = job.requisition.projectDrawing
                                        .getDrawingNo();
                        ledger.actor = actor;

                        ledgerRepository.save(ledger);
                }

                private BigDecimal positive(
                                BigDecimal value,
                                String field) {
                        BigDecimal result = scale(value);

                        if (result.compareTo(
                                        BigDecimal.ZERO) <= 0) {
                                throw badRequest(
                                                field +
                                                                " must be greater than zero");
                        }

                        return result;
                }

                private BigDecimal nonNegative(
                                BigDecimal value,
                                String field) {
                        BigDecimal result = scale(value);

                        if (result.compareTo(
                                        BigDecimal.ZERO) < 0) {
                                throw badRequest(
                                                field +
                                                                " cannot be negative");
                        }

                        return result;
                }

                private BigDecimal scale(
                                BigDecimal value) {
                        return value == null
                                        ? BigDecimal.ZERO
                                        : value.setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);
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

                private void assertVersion(
                                Long requested,
                                Long current) {
                        if (requested == null) {
                                throw badRequest(
                                                "Processing job rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                "Processing job was modified by another user");
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

        private static final class ConsumptionModule {

                private final MatFlowProductionConsumptionRepository consumptionRepository;
                private final MatFlowProductionConsumptionLineRepository consumptionLineRepository;
                private final MatFlowMaterialRequisitionRepository requisitionRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowLocationRepository locationRepository;
                private final MatFlowStockBalanceRepository stockRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;
                private final MatFlowRequisitionService requisitionService;

                ConsumptionModule(
                                MatFlowProductionConsumptionRepository consumptionRepository,
                                MatFlowProductionConsumptionLineRepository consumptionLineRepository,
                                MatFlowMaterialRequisitionRepository requisitionRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowLocationRepository locationRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService,
                                MatFlowRequisitionService requisitionService) {
                        this.consumptionRepository = consumptionRepository;

                        this.consumptionLineRepository = consumptionLineRepository;

                        this.requisitionRepository = requisitionRepository;

                        this.requisitionLineRepository = requisitionLineRepository;

                        this.locationRepository = locationRepository;

                        this.stockRepository = stockRepository;

                        this.ledgerRepository = ledgerRepository;

                        this.accessService = accessService;
                        this.auditService = auditService;
                        this.requisitionService = requisitionService;
                }

                @Transactional(readOnly = true)
                public List<ConsumptionResponse> list() {
                        accessService.requireRead();

                        return consumptionRepository
                                        .findAllByOrderByConsumedAtDesc()
                                        .stream()
                                        .filter(consumption -> accessService.canAccessPlant(
                                                        consumption.productionLocation.getPlantCode()))
                                        .map(this::toResponse)
                                        .toList();
                }

                @Transactional
                public ConsumptionResponse consume(
                                ConsumptionRequest request) {
                        accessService.requireProductionRequest();

                        if (request == null ||
                                        request.requisitionId() == null ||
                                        request.productionLocationId() == null ||
                                        request.lines() == null ||
                                        request.lines().isEmpty()) {
                                throw badRequest(
                                                "Requisition, production location and consumption lines are required");
                        }

                        MatFlowMaterialRequisition requisition = requisitionRepository
                                        .findById(
                                                        request.requisitionId())
                                        .orElseThrow(() -> notFound(
                                                        "Requisition not found"));

                        requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(
                                        requisition);

                        if (requisition.destinationLocation != null) {
                                requisition.destinationLocation = (MatFlowLocation) Hibernate.unproxy(
                                                requisition.destinationLocation);
                        }

                        if (requisition.projectDrawing != null) {
                                requisition.projectDrawing = (MatFlowProjectDrawing) Hibernate.unproxy(
                                                requisition.projectDrawing);
                        }

                        if (requisition.destinationLocation == null) {
                                throw conflict(
                                                "Production consumption requisition has no Production destination");
                        }

                        if (requisition.projectDrawing == null) {
                                throw conflict(
                                                "Production consumption requisition has no Project/Drawing");
                        }

                        MatFlowLocation productionLocation = locationRepository
                                        .findById(
                                                        request.productionLocationId())
                                        .orElseThrow(() -> notFound(
                                                        "Production location not found"));

                        productionLocation = (MatFlowLocation) Hibernate.unproxy(
                                        productionLocation);

                        accessService.requirePlantAccess(
                                        productionLocation.getPlantCode());

                        if (productionLocation.getLocationType() != LocationType.PRODUCTION) {
                                throw badRequest(
                                                "Consumption location must be a production location");
                        }

                        if (!productionLocation.getId()
                                        .equals(
                                                        requisition.destinationLocation
                                                                        .getId())) {
                                throw conflict(
                                                "Consumption location does not match the requisition destination");
                        }

                        if (requisition.status != RequisitionStatus.PRODUCTION_STARTED) {
                                throw conflict(
                                                "Production consumption is allowed only after Production is started");
                        }

                        String actor = accessService.actor();

                        MatFlowProductionConsumption consumption = new MatFlowProductionConsumption();

                        consumption.consumptionNumber = generateNumber("MFC");

                        consumption.requisition = requisition;

                        consumption.productionLocation = productionLocation;

                        consumption.consumedBy = actor;

                        consumption.consumedAt = LocalDateTime.now();

                        consumption.remarks = clean(request.remarks());

                        consumption.setCreatedBy(actor);
                        consumption.setUpdatedBy(actor);

                        consumption = consumptionRepository.save(
                                        consumption);

                        Set<UUID> uniqueLines = new HashSet<>();

                        for (ConsumptionLineRequest lineRequest : request.lines()) {
                                if (lineRequest == null ||
                                                lineRequest.requisitionLineId() == null) {
                                        throw badRequest(
                                                        "Every consumption line requires a requisition line");
                                }

                                if (!uniqueLines.add(
                                                lineRequest.requisitionLineId())) {
                                        throw badRequest(
                                                        "A requisition line was selected more than once");
                                }

                                MatFlowRequisitionLine requisitionLine = requisitionLineRepository
                                                .findById(
                                                                lineRequest.requisitionLineId())
                                                .orElseThrow(() -> notFound(
                                                                "Requisition line not found"));

                                requisitionLine = (MatFlowRequisitionLine) Hibernate.unproxy(
                                                requisitionLine);

                                if (requisitionLine.requisition == null ||
                                                requisitionLine.requisition.getId() == null) {
                                        throw conflict(
                                                        "Production consumption line is not linked to a requisition: " +
                                                                        requisitionLine.getId());
                                }

                                if (!requisitionLine.requisition
                                                .getId()
                                                .equals(
                                                                requisition.getId())) {
                                        throw badRequest(
                                                        "Requisition line does not belong to the selected requisition");
                                }

                                if (requisitionLine.issuedMaterial != null) {
                                        requisitionLine.issuedMaterial = (MatFlowMaterial) Hibernate.unproxy(
                                                        requisitionLine.issuedMaterial);
                                }

                                if (requisitionLine.material != null) {
                                        requisitionLine.material = (MatFlowMaterial) Hibernate.unproxy(
                                                        requisitionLine.material);
                                }

                                /*
                                 * The BOM material may be raw material while the
                                 * issued material may be its processed output.
                                 */
                                MatFlowMaterial consumptionMaterial = requisitionLine.issuedMaterial != null
                                                ? requisitionLine.issuedMaterial
                                                : requisitionLine.material;

                                if (consumptionMaterial == null) {
                                        throw conflict(
                                                        "Production consumption material is missing for requisition line: "
                                                                        +
                                                                        requisitionLine.getId());
                                }

                                BigDecimal quantity = positive(
                                                lineRequest.quantity(),
                                                "Consumption quantity");

                                BigDecimal outstandingIssued = scale(
                                                requisitionLine.issuedQty)
                                                .subtract(
                                                                scale(
                                                                                requisitionLine.consumedQty))
                                                .subtract(
                                                                scale(
                                                                                requisitionLine.returnedQty));

                                if (outstandingIssued.compareTo(
                                                BigDecimal.ZERO) <= 0) {
                                        throw conflict(
                                                        "No unused issued quantity remains for " +
                                                                        consumptionMaterial
                                                                                        .getMaterialCode());
                                }

                                if (quantity.compareTo(
                                                outstandingIssued) > 0) {
                                        throw conflict(
                                                        "Consumption exceeds unused issued quantity for " +
                                                                        consumptionMaterial
                                                                                        .getMaterialCode());
                                }

                                MatFlowStockBalance balance = stockRepository
                                                .lockBalance(
                                                                consumptionMaterial
                                                                                .getId(),
                                                                productionLocation
                                                                                .getId())
                                                .orElseThrow(() -> conflict(
                                                                "Production stock balance not found for " +
                                                                                consumptionMaterial
                                                                                                .getMaterialCode()));

                                BigDecimal usable = balance.onHandQty
                                                .subtract(
                                                                balance.blockedQty);

                                if (usable.compareTo(
                                                quantity) < 0) {
                                        throw conflict(
                                                        "Insufficient production stock for " +
                                                                        consumptionMaterial
                                                                                        .getMaterialCode());
                                }

                                balance.onHandQty = scale(
                                                balance.onHandQty
                                                                .subtract(quantity));

                                balance.setUpdatedBy(actor);

                                balance = stockRepository.save(
                                                balance);

                                requisitionLine.consumedQty = scale(
                                                requisitionLine.consumedQty
                                                                .add(quantity));

                                requisitionLine.setUpdatedBy(actor);

                                requisitionLineRepository.save(
                                                requisitionLine);

                                MatFlowProductionConsumptionLine line = new MatFlowProductionConsumptionLine();

                                line.consumption = consumption;

                                line.requisitionLine = requisitionLine;

                                line.material = consumptionMaterial;

                                line.consumedQty = quantity;

                                line.uom = consumptionMaterial.getUom();

                                line.batchNo = clean(
                                                lineRequest.batchNo());

                                line.remarks = clean(
                                                lineRequest.remarks());

                                line.setCreatedBy(actor);
                                line.setUpdatedBy(actor);

                                consumptionLineRepository.save(
                                                line);

                                saveLedger(
                                                balance,
                                                consumption,
                                                quantity,
                                                line.batchNo,
                                                actor);
                        }

                        auditService.record(
                                        "PRODUCTION_CONSUMPTION",
                                        consumption.getId(),
                                        "MATERIAL_CONSUMED",
                                        productionLocation.getPlantCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "consumptionNumber", consumption.consumptionNumber,
                                                        "requisitionNumber", requisition.requisitionNumber,
                                                        "lineCount", request.lines().size()));

                        requisitionService.refreshState(
                                        requisition.getId(),
                                        actor);

                        return toResponse(consumption);
                }

                private ConsumptionResponse toResponse(
                                MatFlowProductionConsumption consumption) {
                        List<ConsumptionLineResponse> lines = consumptionLineRepository
                                        .findByConsumption_IdOrderByCreatedAtAsc(
                                                        consumption.getId())
                                        .stream()
                                        .map(line -> new ConsumptionLineResponse(
                                                        line.getId(),
                                                        line.requisitionLine
                                                                        .getId(),
                                                        line.material
                                                                        .getMaterialCode(),
                                                        line.consumedQty,
                                                        line.uom,
                                                        line.batchNo))
                                        .toList();

                        return new ConsumptionResponse(
                                        consumption.getId(),
                                        consumption.consumptionNumber,
                                        consumption.requisition.getId(),
                                        consumption.requisition.requisitionNumber,
                                        consumption.productionLocation
                                                        .getId(),
                                        consumption.productionLocation.getLocationCode(),
                                        consumption.productionLocation.getPlantCode(),
                                        consumption.consumedBy,
                                        consumption.consumedAt,
                                        consumption.remarks,
                                        lines);
                }

                private void saveLedger(
                                MatFlowStockBalance balance,
                                MatFlowProductionConsumption consumption,
                                BigDecimal quantity,
                                String batchNo,
                                String actor) {
                        MatFlowStockLedger ledger = new MatFlowStockLedger();

                        ledger.material = balance.material;

                        ledger.location = balance.location;

                        ledger.movementType = MovementType.PRODUCTION_CONSUMPTION;

                        ledger.quantityChange = quantity.negate();

                        ledger.reservedChange = BigDecimal.ZERO;

                        ledger.blockedChange = BigDecimal.ZERO;

                        ledger.inTransitChange = BigDecimal.ZERO;

                        ledger.onHandAfter = balance.onHandQty;

                        ledger.reservedAfter = balance.reservedQty;

                        ledger.blockedAfter = balance.blockedQty;

                        ledger.inTransitAfter = balance.inTransitQty;

                        ledger.referenceType = "MATFLOW_PRODUCTION_CONSUMPTION";

                        ledger.referenceId = consumption.getId();

                        ledger.referenceNumber = consumption.consumptionNumber;

                        ledger.projectCode = consumption.requisition.projectDrawing
                                        .getProjectCode();

                        ledger.drawingNo = consumption.requisition.projectDrawing
                                        .getDrawingNo();

                        ledger.batchNo = batchNo;

                        ledger.actor = actor;

                        ledgerRepository.save(ledger);
                }

                private BigDecimal positive(
                                BigDecimal value,
                                String field) {
                        BigDecimal result = scale(value);

                        if (result.compareTo(
                                        BigDecimal.ZERO) <= 0) {
                                throw badRequest(
                                                field +
                                                                " must be greater than zero");
                        }

                        return result;
                }

                private BigDecimal scale(
                                BigDecimal value) {
                        return value == null
                                        ? BigDecimal.ZERO
                                        : value.setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);
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
