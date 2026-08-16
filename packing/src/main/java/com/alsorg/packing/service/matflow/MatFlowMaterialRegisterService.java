package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialRegisterDtos.MaterialRegisterResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialRegisterDtos.MaterialRegisterRow;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProcessingJobRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Read-only MatFlow material usage register.
 *
 * This is deliberately NOT a physical stock register. Tally remains the
 * authority for Store on-hand, minimum stock, reorder level and stock
 * adjustments. MatFlow reports only workflow quantities that MatFlow itself
 * knows: purchased/received, issued, consumed, wastage and returned quantities.
 *
 * Legacy onHandQty/availableQty fields are returned as zero for response
 * compatibility and must not be interpreted as Store stock.
 */
@Service
public class MatFlowMaterialRegisterService {
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

    private final MatFlowMaterialRepository materialRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowProcessingJobRepository processingJobRepository;
    private final MatFlowAccessService accessService;

    public MatFlowMaterialRegisterService(
            MatFlowMaterialRepository materialRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowProcessingJobRepository processingJobRepository,
            MatFlowAccessService accessService) {
        this.materialRepository = materialRepository;
        this.ledgerRepository = ledgerRepository;
        this.processingJobRepository = processingJobRepository;
        this.accessService = accessService;
    }

    /**
     * Backward-compatible overload for callers/controllers that do not request a
     * date range. The usage register remains non-stock and simply returns all
     * recorded MatFlow usage visible to the caller.
     */
    @Transactional(readOnly = true)
    public MaterialRegisterResponse register(String plantCode, String search) {
        return register(plantCode, search, null, null);
    }

    @Transactional(readOnly = true)
    public MaterialRegisterResponse register(
            String plantCode,
            String search,
            LocalDateTime from,
            LocalDateTime to) {

        accessService.requireRead();

        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Material usage 'from' date cannot be after 'to' date");
        }

        String plant = cleanUpper(plantCode);
        if (plant != null) {
            accessService.requirePlantAccess(plant);
        }
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);

        List<MatFlowStockLedger> ledger = ledgerRepository.findAll().stream()
                .filter(row -> row != null && row.material != null && row.location != null)
                .filter(row -> accessService.canAccessPlant(row.location.getPlantCode()))
                .filter(row -> plant == null || plant.equals(cleanUpper(row.location.getPlantCode())))
                .filter(row -> within(row.actionAt, from, to))
                .toList();

        List<MatFlowProcessingJob> jobs = processingJobRepository.findAll().stream()
                .filter(job -> job != null && job.location != null && job.inputMaterial != null)
                .filter(job -> accessService.canAccessPlant(job.location.getPlantCode()))
                .filter(job -> plant == null || plant.equals(cleanUpper(job.location.getPlantCode())))
                .filter(job -> within(job.completedAt, from, to))
                .toList();

        List<MaterialRegisterRow> rows = materialRepository.findAll().stream()
                .filter(material -> matches(material, query))
                .map(material -> build(material, ledger, jobs))
                .filter(this::hasUsage)
                .sorted(Comparator.comparing(
                        MaterialRegisterRow::materialCode,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();

        return new MaterialRegisterResponse(LocalDateTime.now(), plant, rows);
    }

    private MaterialRegisterRow build(
            MatFlowMaterial material,
            List<MatFlowStockLedger> allLedger,
            List<MatFlowProcessingJob> allJobs) {

        UUID materialId = material.getId();

        List<MatFlowStockLedger> ledger = allLedger.stream()
                .filter(row -> materialId.equals(row.material.getId()))
                .toList();

        BigDecimal purchased = movementQuantity(ledger, MovementType.RECEIPT);

        BigDecimal issued = ledger.stream()
                .filter(row -> row.movementType == MovementType.ISSUE_TO_PRODUCTION)
                .map(row -> {
                    BigDecimal reserved = abs(row.reservedChange);
                    return reserved.compareTo(ZERO) > 0 ? reserved : abs(row.quantityChange);
                })
                .reduce(ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);

        BigDecimal consumed = movementQuantity(ledger, MovementType.PRODUCTION_CONSUMPTION);

        BigDecimal productionWaste = ledger.stream()
                .filter(row -> row.movementType == MovementType.SCRAP)
                .filter(row -> "MATFLOW_PRODUCTION_WASTE".equals(row.referenceType))
                .map(row -> abs(row.quantityChange))
                .reduce(ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);

        BigDecimal processingWaste = allJobs.stream()
                .filter(job -> job.inputMaterial != null && materialId.equals(job.inputMaterial.getId()))
                .map(job -> scale(job.wastageQty))
                .reduce(ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);

        BigDecimal returned = movementQuantity(ledger, MovementType.MATERIAL_RETURN_IN);

        LocalDateTime last = ledger.stream()
                .map(row -> row.actionAt)
                .filter(value -> value != null)
                .max(LocalDateTime::compareTo)
                .orElseGet(() -> allJobs.stream()
                        .filter(job -> job.inputMaterial != null && materialId.equals(job.inputMaterial.getId()))
                        .map(job -> job.completedAt)
                        .filter(value -> value != null)
                        .max(LocalDateTime::compareTo)
                        .orElse(null));

        return new MaterialRegisterRow(
                materialId,
                material.getMaterialCode(),
                material.getMaterialName(),
                material.getCategory(),
                material.getSpecification(),
                material.getUom(),
                purchased,
                issued,
                consumed,
                productionWaste,
                processingWaste,
                returned,
                ZERO, // onHandQty: intentionally not a MatFlow stock figure
                ZERO, // availableQty: intentionally not a MatFlow stock figure
                last);
    }

    private boolean hasUsage(MaterialRegisterRow row) {
        return row.purchasedQty().compareTo(ZERO) != 0
                || row.issuedQty().compareTo(ZERO) != 0
                || row.consumedQty().compareTo(ZERO) != 0
                || row.productionWastedQty().compareTo(ZERO) != 0
                || row.processingWastedQty().compareTo(ZERO) != 0
                || row.returnedQty().compareTo(ZERO) != 0;
    }

    /** Physical-flow event quantity independent of sign convention in the ledger. */
    private BigDecimal movementQuantity(List<MatFlowStockLedger> ledger, MovementType type) {
        return ledger.stream()
                .filter(row -> row.movementType == type)
                .map(row -> abs(row.quantityChange))
                .reduce(ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);
    }

    private boolean within(LocalDateTime value, LocalDateTime from, LocalDateTime to) {
        if (value == null) {
            return from == null && to == null;
        }
        if (from != null && value.isBefore(from)) {
            return false;
        }
        return to == null || !value.isAfter(to);
    }

    private boolean matches(MatFlowMaterial material, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        return contains(material.getMaterialCode(), query)
                || contains(material.getMaterialName(), query)
                || contains(material.getCategory(), query)
                || contains(material.getSpecification(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private BigDecimal scale(BigDecimal value) {
        return value == null ? ZERO : value.setScale(3, RoundingMode.HALF_UP);
    }

    private BigDecimal abs(BigDecimal value) {
        return scale(value).abs().setScale(3, RoundingMode.HALF_UP);
    }

    private String cleanUpper(String value) {
        if (value == null || value.trim().isBlank()) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
