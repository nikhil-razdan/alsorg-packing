package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobStartRequest;

import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;

import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowProcessingService {

        private final MatFlowProcessingJobRepository jobRepository;
        private final MatFlowReservationRepository reservationRepository;
        private final MatFlowBomRouteStepRepository routeRepository;
        private final MatFlowMaterialRepository materialRepository;
        private final MatFlowStockBalanceRepository stockRepository;
        private final MatFlowStockLedgerRepository ledgerRepository;
        private final MatFlowTransferOrderRepository transferRepository;
        private final MatFlowTransferLineRepository transferLineRepository;
        private final MatFlowRequisitionLineRepository requisitionLineRepository;
        private final MatFlowMaterialRequisitionRepository requisitionRepository;
        private final MatFlowIndentRepository indentRepository;
        private final MatFlowIndentLineRepository indentLineRepository;
        private final MatFlowAccessService accessService;
        private final MatFlowAuditService auditService;

        public MatFlowProcessingService(
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
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService) {
                this.jobRepository = jobRepository;
                this.reservationRepository = reservationRepository;
                this.routeRepository = routeRepository;
                this.materialRepository = materialRepository;
                this.stockRepository = stockRepository;
                this.ledgerRepository = ledgerRepository;
                this.transferRepository = transferRepository;
                this.transferLineRepository = transferLineRepository;
                this.requisitionLineRepository = requisitionLineRepository;
                this.requisitionRepository = requisitionRepository;
                this.indentRepository = indentRepository;
                this.indentLineRepository = indentLineRepository;
                this.accessService = accessService;
                this.auditService = auditService;
        }

        @Transactional(readOnly = true)
        public List<ProcessingJobResponse> list() {
                accessService.requireRead();

                return jobRepository
                                .findAllByOrderByUpdatedAtDesc()
                                .stream()
                                .filter(job -> accessService.canAccessPlant(
                                                job.location.plantCode))
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
                                routeStep.location.plantCode);

                if (jobRepository
                                .findByReservation_IdAndRouteStep_Id(
                                                reservation.getId(),
                                                routeStep.getId())
                                .isPresent()) {
                        throw conflict(
                                        "A processing job already exists for this reservation and route step");
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

                if (plannedQty.compareTo(
                                reservation.reservedQty) > 0) {
                        throw conflict(
                                        "Processing quantity exceeds reserved quantity");
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

                return toResponse(
                                jobRepository.save(job));
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
                                job.location.plantCode,
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

                requisition.status = RequisitionStatus.SHORTAGE_PENDING;

                requisition.setUpdatedBy(actor);

                requisitionRepository.save(
                                requisition);

                MatFlowIndent indent = new MatFlowIndent();

                indent.indentNumber = generateNumber("MFI");

                indent.requisition = requisition;

                indent.projectDrawing = requisition.projectDrawing;

                indent.bom = requisition.bom;

                indent.deliverToLocation = job.location;

                indent.status = MatFlowPlanningTypes.IndentStatus.AUTO_CREATED;

                indent.autoGenerated = true;

                indent.remarks = "Automatically created for processing wastage";

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
                                job.location.plantCode);

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
                                job.location.locationCode,
                                job.location.plantCode,
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