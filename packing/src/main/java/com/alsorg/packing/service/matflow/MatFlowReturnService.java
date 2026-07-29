package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnResponse;

import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowMaterialReturn;
import com.alsorg.packing.domain.matflow.MatFlowMaterialReturnLine;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnReason;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;

import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialReturnLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialReturnRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;

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
public class MatFlowReturnService {

    private final MatFlowMaterialReturnRepository returnRepository;
    private final MatFlowMaterialReturnLineRepository returnLineRepository;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;
    private final MatFlowLocationRepository locationRepository;
    private final MatFlowStockBalanceRepository stockRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowAccessService accessService;

    public MatFlowReturnService(
            MatFlowMaterialReturnRepository returnRepository,
            MatFlowMaterialReturnLineRepository returnLineRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowLocationRepository locationRepository,
            MatFlowStockBalanceRepository stockRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowAccessService accessService) {
        this.returnRepository = returnRepository;

        this.returnLineRepository = returnLineRepository;

        this.requisitionRepository = requisitionRepository;

        this.requisitionLineRepository = requisitionLineRepository;

        this.locationRepository = locationRepository;

        this.stockRepository = stockRepository;

        this.ledgerRepository = ledgerRepository;

        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<MaterialReturnResponse> list() {
        accessService.requireRead();

        return returnRepository
                .findAllByOrderByUpdatedAtDesc()
                .stream()
                .filter(materialReturn -> accessService.canAccessPlant(
                        materialReturn.fromLocation.plantCode) ||
                        accessService.canAccessPlant(
                                materialReturn.toLocation.plantCode))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public MaterialReturnResponse create(
            MaterialReturnCreateRequest request) {
        accessService.requireProductionReturnCreate();

        validateCreateRequest(request);

        MatFlowMaterialRequisition requisition = requisitionRepository
                .findById(request.requisitionId())
                .orElseThrow(() -> notFound(
                        "Requisition not found"));

        MatFlowLocation fromLocation = requireLocation(
                request.fromLocationId());

        MatFlowLocation toLocation = requireLocation(
                request.toLocationId());

        if (fromLocation.locationType != LocationType.PRODUCTION) {
            throw badRequest(
                    "Return source must be a production location");
        }

        if (!fromLocation.getId()
                .equals(
                        requisition.destinationLocation
                                .getId())) {
            throw conflict(
                    "Return source does not match the requisition production location");
        }

        if (toLocation.locationType == LocationType.PRODUCTION) {
            throw badRequest(
                    "Return destination cannot be another production location");
        }

        if (!toLocation.supportsStock) {
            throw badRequest(
                    "Return destination does not support stock");
        }

        String actor = accessService.actor();

        MatFlowMaterialReturn materialReturn = new MatFlowMaterialReturn();

        materialReturn.returnNumber = generateNumber("MFRN");

        materialReturn.requisition = requisition;

        materialReturn.fromLocation = fromLocation;

        materialReturn.toLocation = toLocation;

        materialReturn.reason = request.reason();

        materialReturn.status = MaterialReturnStatus.DRAFT;

        materialReturn.createdForReturnBy = actor;

        materialReturn.remarks = clean(request.remarks());

        materialReturn.setCreatedBy(actor);
        materialReturn.setUpdatedBy(actor);

        materialReturn = returnRepository.save(
                materialReturn);

        Set<UUID> uniqueLines = new HashSet<>();

        for (MaterialReturnLineRequest lineRequest : request.lines()) {
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
                        "Return line does not belong to the selected requisition");
            }

            MatFlowMaterial material = requisitionLine.issuedMaterial != null
                    ? requisitionLine.issuedMaterial
                    : requisitionLine.material;

            BigDecimal returnQty = positive(
                    lineRequest.returnQty(),
                    "Return quantity");

            BigDecimal returnable = requisitionLine.issuedQty
                    .subtract(
                            requisitionLine.consumedQty)
                    .subtract(
                            requisitionLine.returnedQty);

            if (returnQty.compareTo(
                    returnable) > 0) {
                throw conflict(
                        "Return quantity exceeds unused issued quantity for " +
                                material.getMaterialCode());
            }

            MatFlowMaterialReturnLine line = new MatFlowMaterialReturnLine();

            line.materialReturn = materialReturn;

            line.requisitionLine = requisitionLine;

            line.material = material;

            line.returnQty = returnQty;

            line.dispatchedQty = BigDecimal.ZERO;

            line.receivedQty = BigDecimal.ZERO;

            line.uom = material.getUom();

            line.batchNo = clean(lineRequest.batchNo());

            line.remarks = clean(lineRequest.remarks());

            line.setCreatedBy(actor);
            line.setUpdatedBy(actor);

            returnLineRepository.save(line);
        }

        return toResponse(materialReturn);
    }

    @Transactional
    public MaterialReturnResponse dispatch(
            UUID id,
            MaterialReturnActionRequest request) {
        MatFlowMaterialReturn materialReturn = requireReturn(id);

        accessService.requireTransferDispatch(
                materialReturn.fromLocation);

        if (materialReturn.status != MaterialReturnStatus.DRAFT) {
            throw conflict(
                    "Only a draft material return can be dispatched");
        }

        assertVersion(
                request == null
                        ? null
                        : request.rowVersion(),
                materialReturn.getRowVersion(),
                "Material return");

        String actor = accessService.actor();

        List<MatFlowMaterialReturnLine> lines = returnLineRepository
                .findByMaterialReturn_IdOrderByCreatedAtAsc(
                        materialReturn.getId());

        for (MatFlowMaterialReturnLine line : lines) {
            MatFlowStockBalance source = stockRepository
                    .lockBalance(
                            line.material.getId(),
                            materialReturn.fromLocation
                                    .getId())
                    .orElseThrow(() -> conflict(
                            "Production stock balance not found for " +
                                    line.material
                                            .getMaterialCode()));

            BigDecimal usable = source.onHandQty
                    .subtract(
                            source.blockedQty);

            if (usable.compareTo(
                    line.returnQty) < 0) {
                throw conflict(
                        "Insufficient production stock for return: " +
                                line.material
                                        .getMaterialCode());
            }

            source.onHandQty = scale(
                    source.onHandQty
                            .subtract(
                                    line.returnQty));

            source.inTransitQty = scale(
                    source.inTransitQty
                            .add(
                                    line.returnQty));

            source.setUpdatedBy(actor);

            source = stockRepository.save(source);

            line.dispatchedQty = line.returnQty;

            line.setUpdatedBy(actor);

            returnLineRepository.save(line);

            saveLedger(
                    source,
                    MovementType.MATERIAL_RETURN_OUT,

                    line.returnQty.negate(),
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    line.returnQty,

                    materialReturn,
                    line,
                    actor);
        }

        materialReturn.status = MaterialReturnStatus.IN_TRANSIT;

        materialReturn.dispatchedBy = actor;

        materialReturn.dispatchedAt = LocalDateTime.now();

        if (request != null &&
                clean(request.remarks()) != null) {
            materialReturn.remarks = clean(request.remarks());
        }

        materialReturn.setUpdatedBy(actor);

        return toResponse(
                returnRepository.save(
                        materialReturn));
    }

    @Transactional
    public MaterialReturnResponse receive(
            UUID id,
            MaterialReturnActionRequest request) {
        MatFlowMaterialReturn materialReturn = requireReturn(id);

        accessService.requireTransferReceive(
                materialReturn.toLocation);

        if (materialReturn.status != MaterialReturnStatus.IN_TRANSIT &&
                materialReturn.status != MaterialReturnStatus.PARTIALLY_RECEIVED) {
            throw conflict(
                    "Material return is not available for receipt");
        }

        assertVersion(
                request == null
                        ? null
                        : request.rowVersion(),
                materialReturn.getRowVersion(),
                "Material return");

        String actor = accessService.actor();

        List<MatFlowMaterialReturnLine> lines = returnLineRepository
                .findByMaterialReturn_IdOrderByCreatedAtAsc(
                        materialReturn.getId());

        for (MatFlowMaterialReturnLine line : lines) {
            BigDecimal outstanding = line.dispatchedQty
                    .subtract(
                            line.receivedQty);

            if (outstanding.compareTo(
                    BigDecimal.ZERO) <= 0) {
                continue;
            }

            MatFlowStockBalance source = stockRepository
                    .lockBalance(
                            line.material.getId(),
                            materialReturn.fromLocation
                                    .getId())
                    .orElseThrow(() -> conflict(
                            "Return source stock balance not found"));

            if (source.inTransitQty
                    .compareTo(
                            outstanding) < 0) {
                throw conflict(
                        "Source in-transit return quantity is inconsistent");
            }

            source.inTransitQty = scale(
                    source.inTransitQty
                            .subtract(outstanding));

            source.setUpdatedBy(actor);

            source = stockRepository.save(source);

            MatFlowStockBalance destination = lockOrCreateBalance(
                    line.material,
                    materialReturn.toLocation,
                    actor);

            destination.onHandQty = scale(
                    destination.onHandQty
                            .add(outstanding));

            BigDecimal blockedAdded = BigDecimal.ZERO;

            if (materialReturn.reason == MaterialReturnReason.DAMAGED ||
                    materialReturn.reason == MaterialReturnReason.PROCESS_REJECTED ||
                    materialReturn.reason == MaterialReturnReason.QC_REJECTED) {
                destination.blockedQty = scale(
                        destination.blockedQty
                                .add(outstanding));

                blockedAdded = outstanding;
            }

            destination.setUpdatedBy(actor);

            destination = stockRepository.save(
                    destination);

            line.receivedQty = scale(
                    line.receivedQty
                            .add(outstanding));

            line.setUpdatedBy(actor);

            returnLineRepository.save(line);

            MatFlowRequisitionLine requisitionLine = line.requisitionLine;

            requisitionLine.returnedQty = scale(
                    requisitionLine.returnedQty
                            .add(outstanding));

            requisitionLine.setUpdatedBy(actor);

            requisitionLineRepository.save(
                    requisitionLine);

            saveLedger(
                    source,
                    MovementType.MATERIAL_RETURN_RECEIPT_CLEAR,

                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    outstanding.negate(),

                    materialReturn,
                    line,
                    actor);

            saveLedger(
                    destination,
                    MovementType.MATERIAL_RETURN_IN,

                    outstanding,
                    BigDecimal.ZERO,
                    blockedAdded,
                    BigDecimal.ZERO,

                    materialReturn,
                    line,
                    actor);
        }

        materialReturn.status = MaterialReturnStatus.RECEIVED;

        materialReturn.receivedBy = actor;

        materialReturn.receivedAt = LocalDateTime.now();

        if (request != null &&
                clean(request.remarks()) != null) {
            materialReturn.remarks = clean(request.remarks());
        }

        materialReturn.setUpdatedBy(actor);

        return toResponse(
                returnRepository.save(
                        materialReturn));
    }

    private MatFlowMaterialReturn requireReturn(
            UUID id) {
        MatFlowMaterialReturn materialReturn = returnRepository
                .findById(id)
                .orElseThrow(() -> notFound(
                        "Material return not found"));

        if (!accessService.canAccessPlant(
                materialReturn.fromLocation.plantCode) &&
                !accessService.canAccessPlant(
                        materialReturn.toLocation.plantCode)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "No access to this material return");
        }

        return materialReturn;
    }

    private MatFlowLocation requireLocation(
            UUID id) {
        MatFlowLocation location = locationRepository
                .findById(id)
                .orElseThrow(() -> notFound(
                        "Location not found"));

        accessService.requirePlantAccess(
                location.plantCode);

        return location;
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

    private MaterialReturnResponse toResponse(
            MatFlowMaterialReturn materialReturn) {
        List<MaterialReturnLineResponse> lines = returnLineRepository
                .findByMaterialReturn_IdOrderByCreatedAtAsc(
                        materialReturn.getId())
                .stream()
                .map(line -> new MaterialReturnLineResponse(
                        line.getId(),
                        line.requisitionLine
                                .getId(),
                        line.material.getId(),
                        line.material
                                .getMaterialCode(),
                        line.material
                                .getMaterialName(),
                        line.returnQty,
                        line.dispatchedQty,
                        line.receivedQty,
                        line.uom,
                        line.batchNo,
                        line.getRowVersion()))
                .toList();

        return new MaterialReturnResponse(
                materialReturn.getId(),
                materialReturn.returnNumber,
                materialReturn.requisition.getId(),
                materialReturn.requisition.requisitionNumber,

                materialReturn.fromLocation.getId(),
                materialReturn.fromLocation.locationCode,
                materialReturn.fromLocation.plantCode,

                materialReturn.toLocation.getId(),
                materialReturn.toLocation.locationCode,
                materialReturn.toLocation.plantCode,

                materialReturn.reason,
                materialReturn.status,

                materialReturn.dispatchedBy,
                materialReturn.dispatchedAt,
                materialReturn.receivedBy,
                materialReturn.receivedAt,

                materialReturn.remarks,
                materialReturn.getRowVersion(),
                lines);
    }

    private void validateCreateRequest(
            MaterialReturnCreateRequest request) {
        if (request == null ||
                request.requisitionId() == null ||
                request.fromLocationId() == null ||
                request.toLocationId() == null ||
                request.reason() == null ||
                request.lines() == null ||
                request.lines().isEmpty()) {
            throw badRequest(
                    "Requisition, locations, reason and return lines are required");
        }

        if (request.fromLocationId()
                .equals(
                        request.toLocationId())) {
            throw badRequest(
                    "Return source and destination must be different");
        }
    }

    private void saveLedger(
            MatFlowStockBalance balance,
            MovementType movementType,
            BigDecimal quantityChange,
            BigDecimal reservedChange,
            BigDecimal blockedChange,
            BigDecimal transitChange,
            MatFlowMaterialReturn materialReturn,
            MatFlowMaterialReturnLine line,
            String actor) {
        MatFlowStockLedger ledger = new MatFlowStockLedger();

        ledger.material = balance.material;

        ledger.location = balance.location;

        ledger.movementType = movementType;

        ledger.quantityChange = scale(quantityChange);

        ledger.reservedChange = scale(reservedChange);

        ledger.blockedChange = scale(blockedChange);

        ledger.inTransitChange = scale(transitChange);

        ledger.onHandAfter = balance.onHandQty;

        ledger.reservedAfter = balance.reservedQty;

        ledger.blockedAfter = balance.blockedQty;

        ledger.inTransitAfter = balance.inTransitQty;

        ledger.referenceType = "MATFLOW_MATERIAL_RETURN";

        ledger.referenceId = materialReturn.getId();

        ledger.referenceNumber = materialReturn.returnNumber;

        ledger.projectCode = materialReturn.requisition.projectDrawing
                .getProjectCode();

        ledger.drawingNo = materialReturn.requisition.projectDrawing
                .getDrawingNo();

        ledger.batchNo = line.batchNo;

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