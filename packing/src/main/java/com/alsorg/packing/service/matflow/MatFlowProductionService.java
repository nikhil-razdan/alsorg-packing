package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobStartRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProductionWasteDtos.ProductionWasteLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProductionWasteDtos.ProductionWasteLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProductionWasteDtos.ProductionWasteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProductionWasteDtos.ProductionWasteResponse;

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
 * Production execution boundary: Store-selected processing jobs, explicit
 * Production start/completion, material consumption and wastage.
 * Processing never raises Purchase Indents; replacement demand returns to
 * Store.
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
                        MatFlowStockBalanceRepository stockRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowTransferOrderRepository transferRepository,
                        MatFlowTransferLineRepository transferLineRepository,
                        MatFlowRequisitionLineRepository requisitionLineRepository,
                        MatFlowMaterialRequisitionRepository requisitionRepository,
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
                                stockRepository,
                                ledgerRepository,
                                transferRepository,
                                transferLineRepository,
                                requisitionLineRepository,
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
        public ProcessingJobResponse createProcessingJobForReservation(
                        UUID reservationId,
                        UUID processingRouteStepId,
                        String remarks) {
                return processing.createForReservation(reservationId, processingRouteStepId, remarks);
        }

        /**
         * Compatibility alias for older internal callers; QC no longer creates routes.
         */
        @Deprecated
        public ProcessingJobResponse createProcessingJobFromQc(
                        UUID reservationId,
                        UUID processingRouteStepId,
                        String remarks) {
                return createProcessingJobForReservation(reservationId, processingRouteStepId, remarks);
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

                accessService.requireProductionOwnership(requisition.requestedBy);
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

        @Transactional
        public ProductionWasteResponse recordProductionWaste(ProductionWasteRequest request) {
                return consumption.recordWaste(request);
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

                accessService.requireProductionOwnership(requisition.requestedBy);
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
                                        .add(zero(line.returnedQty))
                                        .add(consumption.productionWasteForLine(line.getId()));

                        return issued.compareTo(requested) >= 0 &&
                                        accounted.compareTo(issued) >= 0;
                });

                if (!fullyAccounted) {
                        throw conflict(
                                        "Production cannot be completed until all requested material is issued and every issued quantity is consumed, wasted or returned");
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
                private final MatFlowStockBalanceRepository stockRepository;
                private final MatFlowStockLedgerRepository ledgerRepository;
                private final MatFlowTransferOrderRepository transferRepository;
                private final MatFlowTransferLineRepository transferLineRepository;
                private final MatFlowRequisitionLineRepository requisitionLineRepository;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;
                private final MatFlowRequisitionService requisitionService;

                ProcessingModule(
                                MatFlowProcessingJobRepository jobRepository,
                                MatFlowReservationRepository reservationRepository,
                                MatFlowBomRouteStepRepository routeRepository,
                                MatFlowStockBalanceRepository stockRepository,
                                MatFlowStockLedgerRepository ledgerRepository,
                                MatFlowTransferOrderRepository transferRepository,
                                MatFlowTransferLineRepository transferLineRepository,
                                MatFlowRequisitionLineRepository requisitionLineRepository,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService,
                                MatFlowRequisitionService requisitionService) {
                        this.jobRepository = jobRepository;
                        this.reservationRepository = reservationRepository;
                        this.routeRepository = routeRepository;
                        this.stockRepository = stockRepository;
                        this.ledgerRepository = ledgerRepository;
                        this.transferRepository = transferRepository;
                        this.transferLineRepository = transferLineRepository;
                        this.requisitionLineRepository = requisitionLineRepository;
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

                ProcessingJobResponse createForReservation(
                                UUID reservationId,
                                UUID routeStepId,
                                String remarks) {
                        if (reservationId == null || routeStepId == null) {
                                throw badRequest("Processing route requires reservation and selected Processing step");
                        }
                        MatFlowReservation reservation = reservationRepository.findById(reservationId)
                                        .orElseThrow(() -> notFound("Reservation not found"));
                        reservation = (MatFlowReservation) Hibernate.unproxy(reservation);
                        MatFlowBomRouteStep rawRouteStep = routeRepository.findById(routeStepId)
                                        .orElseThrow(() -> notFound("Processing route step not found"));
                        final MatFlowBomRouteStep routeStep = (MatFlowBomRouteStep) Hibernate.unproxy(rawRouteStep);

                        if (routeStep.stepType != RouteStepType.PROCESSING) {
                                throw badRequest("Selected BOM route step is not a Processing step");
                        }
                        if (reservation.requisitionLine == null || reservation.requisitionLine.bomLine == null ||
                                        routeStep.bomLine == null ||
                                        !routeStep.bomLine.getId()
                                                        .equals(reservation.requisitionLine.bomLine.getId())) {
                                throw conflict("Processing route step does not belong to the reserved BOM material line");
                        }
                        accessService.requirePlantAccess(routeStep.location.getPlantCode());

                        ProcessingJobResponse existing = jobRepository
                                        .findByReservation_IdAndRouteStep_Id(reservationId, routeStepId)
                                        .map(this::toResponse).orElse(null);
                        if (existing != null) {
                                return existing;
                        }

                        boolean receivedAtProcessor = transferRepository
                                        .findByReservation_IdOrderByRouteSequenceNoAsc(reservationId)
                                        .stream()
                                        .filter(transfer -> transfer != null && transfer.toLocation != null &&
                                                        transfer.status == TransferStatus.RECEIVED &&
                                                        routeStep.location.getId().equals(transfer.toLocation.getId()))
                                        .anyMatch(transfer -> transferLineRepository
                                                        .findFirstByTransferOrder_IdOrderByCreatedAtAsc(
                                                                        transfer.getId())
                                                        .map(line -> routeStepId.equals(line.routeStepId))
                                                        .orElse(false));
                        if (!receivedAtProcessor) {
                                throw conflict("Material has not yet been received by the selected Processing Unit");
                        }

                        String actor = accessService.actor();
                        MatFlowProcessingJob job = new MatFlowProcessingJob();
                        job.jobNumber = generateNumber("MFP");
                        job.requisition = reservation.requisitionLine.requisition;
                        job.reservation = reservation;
                        job.routeStep = routeStep;
                        job.location = routeStep.location;
                        job.inputMaterial = reservation.material;
                        job.outputMaterial = reservation.material;
                        job.plannedInputQty = scale(reservation.reservedQty);
                        job.status = ProcessingJobStatus.PENDING;
                        job.remarks = clean(remarks);
                        job.setCreatedBy(actor);
                        job.setUpdatedBy(actor);
                        job = jobRepository.save(job);

                        auditService.record(
                                        "PROCESSING_JOB", job.getId(), "PROCESSING_JOB_QUEUED_FROM_STORE_ROUTE",
                                        job.location.getPlantCode(),
                                        job.requisition == null || job.requisition.projectDrawing == null ? null
                                                        : job.requisition.projectDrawing.getProjectCode(),
                                        job.requisition == null || job.requisition.projectDrawing == null ? null
                                                        : job.requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "jobNumber", job.jobNumber,
                                                        "reservationId", reservationId,
                                                        "routeStepId", routeStepId,
                                                        "plannedInputQty", job.plannedInputQty));
                        if (job.requisition != null) {
                                requisitionService.refreshState(job.requisition.getId(), actor);
                        }
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

                /**
                 * Processing wastage creates replacement demand on the linked MR only.
                 * Store remains the sole authority that may create a Purchase Indent
                 * after checking physical inventory for that replacement demand.
                 */
                private void registerProcessingShortage(
                                MatFlowProcessingJob job,
                                BigDecimal wastageQty,
                                String actor) {
                        MatFlowRequisitionLine requisitionLine = job.reservation.requisitionLine;
                        if (requisitionLine == null || requisitionLine.requisition == null) {
                                throw conflict("Processing job is not linked to a valid MR line");
                        }

                        requisitionLine.reservedQty = scale(
                                        scale(requisitionLine.reservedQty)
                                                        .subtract(wastageQty)
                                                        .max(BigDecimal.ZERO));
                        requisitionLine.shortageQty = scale(
                                        scale(requisitionLine.shortageQty)
                                                        .add(wastageQty));
                        requisitionLine.setUpdatedBy(actor);
                        requisitionLineRepository.save(requisitionLine);

                        MatFlowMaterialRequisition requisition = requisitionLine.requisition;

                        auditService.record(
                                        "REQUISITION_LINE",
                                        requisitionLine.getId(),
                                        "PROCESSING_REPLACEMENT_DEMAND_RAISED",
                                        requisition.destinationLocation == null
                                                        ? job.location.getPlantCode()
                                                        : requisition.destinationLocation.getPlantCode(),
                                        requisition.projectDrawing == null
                                                        ? null
                                                        : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null
                                                        ? null
                                                        : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "requisitionNumber", requisition.requisitionNumber,
                                                        "processingJobNumber", job.jobNumber,
                                                        "materialCode", job.inputMaterial == null
                                                                        ? null
                                                                        : job.inputMaterial.getMaterialCode(),
                                                        "replacementQty", wastageQty,
                                                        "nextOwner", "STORE",
                                                        "nextAction", "CHECK_STOCK_AND_RAISE_PI_IF_REQUIRED"));

                        requisitionService.refreshState(requisition.getId(), actor);
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

                        accessService.requireProductionOwnership(requisition.requestedBy);

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

                                BigDecimal outstandingIssued = scale(requisitionLine.issuedQty)
                                                .subtract(scale(requisitionLine.consumedQty))
                                                .subtract(scale(requisitionLine.returnedQty))
                                                .subtract(productionWasteForLine(requisitionLine.getId()))
                                                .max(BigDecimal.ZERO)
                                                .setScale(3, RoundingMode.HALF_UP);

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

                ProductionWasteResponse recordWaste(ProductionWasteRequest request) {
                        accessService.requireProductionRequest();
                        if (request == null || request.requisitionId() == null ||
                                        request.productionLocationId() == null || request.lines() == null ||
                                        request.lines().isEmpty()) {
                                throw badRequest("Requisition, Production location and wastage lines are required");
                        }

                        MatFlowMaterialRequisition requisition = requisitionRepository.findById(request.requisitionId())
                                        .orElseThrow(() -> notFound("Requisition not found"));
                        requisition = (MatFlowMaterialRequisition) Hibernate.unproxy(requisition);
                        if (requisition.destinationLocation != null) {
                                requisition.destinationLocation = (MatFlowLocation) Hibernate
                                                .unproxy(requisition.destinationLocation);
                        }
                        if (requisition.projectDrawing != null) {
                                requisition.projectDrawing = (MatFlowProjectDrawing) Hibernate
                                                .unproxy(requisition.projectDrawing);
                        }
                        accessService.requireProductionOwnership(requisition.requestedBy);
                        if (requisition.status != RequisitionStatus.PRODUCTION_STARTED) {
                                throw conflict("Production wastage can be recorded only after Production has started");
                        }

                        MatFlowLocation location = locationRepository.findById(request.productionLocationId())
                                        .orElseThrow(() -> notFound("Production location not found"));
                        location = (MatFlowLocation) Hibernate.unproxy(location);
                        accessService.requirePlantAccess(location.getPlantCode());
                        if (location.getLocationType() != LocationType.PRODUCTION ||
                                        requisition.destinationLocation == null ||
                                        !location.getId().equals(requisition.destinationLocation.getId())) {
                                throw conflict("Wastage must be recorded at the requisition Production location");
                        }

                        String actor = accessService.actor();
                        LocalDateTime now = LocalDateTime.now();
                        Set<UUID> uniqueLines = new HashSet<>();
                        List<ProductionWasteLineResponse> responses = new java.util.ArrayList<>();

                        for (ProductionWasteLineRequest lineRequest : request.lines()) {
                                if (lineRequest == null || lineRequest.requisitionLineId() == null ||
                                                !uniqueLines.add(lineRequest.requisitionLineId())) {
                                        throw badRequest("Every wastage line must identify a unique MR material line");
                                }
                                MatFlowRequisitionLine line = requisitionLineRepository
                                                .findById(lineRequest.requisitionLineId())
                                                .orElseThrow(() -> notFound("Requisition material line not found"));
                                line = (MatFlowRequisitionLine) Hibernate.unproxy(line);
                                if (line.requisition == null || !requisition.getId().equals(line.requisition.getId())) {
                                        throw badRequest(
                                                        "Wastage line does not belong to the selected Material Requisition");
                                }
                                MatFlowMaterial rawMaterial = line.issuedMaterial == null ? line.material
                                                : line.issuedMaterial;
                                if (rawMaterial == null) {
                                        throw conflict("Requisition line has no issued material");
                                }
                                final MatFlowMaterial material = (MatFlowMaterial) Hibernate.unproxy(rawMaterial);

                                BigDecimal qty = positive(lineRequest.wastedQty(), "Wasted quantity");
                                BigDecimal remainingIssued = scale(line.issuedQty)
                                                .subtract(scale(line.consumedQty))
                                                .subtract(scale(line.returnedQty))
                                                .subtract(productionWasteForLine(line.getId()))
                                                .max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);
                                if (qty.compareTo(remainingIssued) > 0) {
                                        throw conflict("Wastage exceeds unaccounted issued quantity for "
                                                        + material.getMaterialCode());
                                }

                                MatFlowStockBalance balance = stockRepository
                                                .lockBalance(material.getId(), location.getId())
                                                .orElseThrow(() -> conflict("Production stock balance not found for "
                                                                + material.getMaterialCode()));
                                BigDecimal usable = scale(balance.onHandQty).subtract(scale(balance.blockedQty));
                                if (usable.compareTo(qty) < 0) {
                                        throw conflict("Insufficient Production stock for wastage of "
                                                        + material.getMaterialCode());
                                }
                                balance.onHandQty = scale(balance.onHandQty).subtract(qty).setScale(3,
                                                RoundingMode.HALF_UP);
                                balance.setUpdatedBy(actor);
                                balance = stockRepository.save(balance);

                                MatFlowStockLedger ledger = new MatFlowStockLedger();
                                ledger.material = material;
                                ledger.location = location;
                                ledger.movementType = MovementType.SCRAP;
                                ledger.quantityChange = qty.negate();
                                ledger.reservedChange = BigDecimal.ZERO;
                                ledger.blockedChange = BigDecimal.ZERO;
                                ledger.inTransitChange = BigDecimal.ZERO;
                                ledger.onHandAfter = balance.onHandQty;
                                ledger.reservedAfter = balance.reservedQty;
                                ledger.blockedAfter = balance.blockedQty;
                                ledger.inTransitAfter = balance.inTransitQty;
                                ledger.referenceType = "MATFLOW_PRODUCTION_WASTE";
                                ledger.referenceId = line.getId();
                                ledger.referenceNumber = requisition.requisitionNumber;
                                ledger.batchNo = clean(lineRequest.batchNo());
                                ledger.projectCode = requisition.projectDrawing == null ? null
                                                : requisition.projectDrawing.getProjectCode();
                                ledger.drawingNo = requisition.projectDrawing == null ? null
                                                : requisition.projectDrawing.getDrawingNo();
                                ledger.remarks = clean(lineRequest.remarks());
                                ledger.actor = actor;
                                ledgerRepository.save(ledger);

                                responses.add(new ProductionWasteLineResponse(
                                                line.getId(), material.getId(), material.getMaterialCode(),
                                                material.getMaterialName(), qty, material.getUom(),
                                                clean(lineRequest.batchNo())));
                        }

                        auditService.record(
                                        "REQUISITION", requisition.getId(), "PRODUCTION_WASTAGE_RECORDED",
                                        location.getPlantCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getProjectCode(),
                                        requisition.projectDrawing == null ? null
                                                        : requisition.projectDrawing.getDrawingNo(),
                                        auditService.details(
                                                        "requisitionNumber", requisition.requisitionNumber,
                                                        "lineCount", responses.size(),
                                                        "totalWastedQty", responses.stream()
                                                                        .map(ProductionWasteLineResponse::wastedQty)
                                                                        .reduce(BigDecimal.ZERO, BigDecimal::add)));
                        requisitionService.refreshState(requisition.getId(), actor);

                        return new ProductionWasteResponse(
                                        requisition.getId(), requisition.requisitionNumber,
                                        location.getId(), location.getLocationCode(), location.getPlantCode(),
                                        actor, now, clean(request.remarks()), List.copyOf(responses));
                }

                BigDecimal productionWasteForLine(UUID requisitionLineId) {
                        if (requisitionLineId == null) {
                                return BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);
                        }
                        return ledgerRepository.findAll().stream()
                                        .filter(entry -> entry != null && entry.movementType == MovementType.SCRAP)
                                        .filter(entry -> "MATFLOW_PRODUCTION_WASTE".equals(entry.referenceType))
                                        .filter(entry -> requisitionLineId.equals(entry.referenceId))
                                        .map(entry -> scale(entry.quantityChange).abs())
                                        .reduce(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP), BigDecimal::add)
                                        .setScale(3, RoundingMode.HALF_UP);
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