package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionResponse;
import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;

import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowProductionExecutionService {

    private final MatFlowProductionConsumptionRepository consumptionRepository;
    private final MatFlowProductionConsumptionLineRepository consumptionLineRepository;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;
    private final MatFlowLocationRepository locationRepository;
    private final MatFlowStockBalanceRepository stockRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowAccessService accessService;

    public MatFlowProductionExecutionService(
            MatFlowProductionConsumptionRepository consumptionRepository,
            MatFlowProductionConsumptionLineRepository consumptionLineRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowLocationRepository locationRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowAccessService accessService) {
        this.consumptionRepository = consumptionRepository;

        this.consumptionLineRepository = consumptionLineRepository;

        this.requisitionRepository = requisitionRepository;

        this.requisitionLineRepository = requisitionLineRepository;

        this.locationRepository = locationRepository;

        this.stockRepository = stockRepository;

        this.ledgerRepository = ledgerRepository;

        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<ConsumptionResponse> list() {
        accessService.requireRead();

        return consumptionRepository
                .findAllByOrderByConsumedAtDesc()
                .stream()
                .filter(consumption -> accessService.canAccessPlant(
                        consumption.productionLocation.plantCode))
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

        MatFlowLocation productionLocation = locationRepository
                .findById(
                        request.productionLocationId())
                .orElseThrow(() -> notFound(
                        "Production location not found"));

        accessService.requirePlantAccess(
                productionLocation.plantCode);

        if (productionLocation.locationType != LocationType.PRODUCTION) {
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

        if (requisition.status == RequisitionStatus.DRAFT ||
                requisition.status == RequisitionStatus.SUBMITTED ||
                requisition.status == RequisitionStatus.CANCELLED ||
                requisition.status == RequisitionStatus.COMPLETED) {
            throw conflict(
                    "Requisition is not available for production consumption");
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

            if (!requisitionLine.requisition
                    .getId()
                    .equals(
                            requisition.getId())) {
                throw badRequest(
                        "Requisition line does not belong to the selected requisition");
            }

            /*
             * The BOM material may be raw material while the
             * issued material may be its processed output.
             *
             * Example:
             * Raw veneer BOM line → processed veneer issued.
             */
            MatFlowMaterial consumptionMaterial = requisitionLine.issuedMaterial != null
                    ? requisitionLine.issuedMaterial
                    : requisitionLine.material;

            BigDecimal quantity = positive(
                    lineRequest.quantity(),
                    "Consumption quantity");

            BigDecimal outstandingIssued = requisitionLine.issuedQty
                    .subtract(
                            requisitionLine.consumedQty)
                    .subtract(
                            requisitionLine.returnedQty);

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

        refreshCompletion(
                requisition,
                actor);

        return toResponse(consumption);
    }

    private void refreshCompletion(
            MatFlowMaterialRequisition requisition,
            String actor) {
        List<MatFlowRequisitionLine> lines = requisitionLineRepository
                .findByRequisition_IdOrderByLineNoAsc(
                        requisition.getId());

        boolean complete = !lines.isEmpty() &&
                lines.stream()
                        .allMatch(line -> {
                            boolean fullyIssued = line.issuedQty
                                    .compareTo(
                                            line.requestedQty) >= 0;

                            BigDecimal accountedQty = line.consumedQty
                                    .add(
                                            line.returnedQty);

                            boolean fullyAccounted = accountedQty
                                    .compareTo(
                                            line.issuedQty) >= 0;

                            return fullyIssued &&
                                    fullyAccounted;
                        });

        if (complete) {
            requisition.status = RequisitionStatus.COMPLETED;

            requisition.setUpdatedBy(actor);

            requisitionRepository.save(
                    requisition);
        }
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
                consumption.productionLocation.locationCode,
                consumption.productionLocation.plantCode,
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