package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialRegisterDtos.MaterialRegisterResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialRegisterDtos.MaterialRegisterRow;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProcessingJobRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only Material Register calculated from immutable stock movements.
 * No duplicate "register stock" table is maintained.
 */
@Service
public class MatFlowMaterialRegisterService {
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

    private final MatFlowMaterialRepository materialRepository;
    private final MatFlowStockBalanceRepository balanceRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowProcessingJobRepository processingJobRepository;
    private final MatFlowAccessService accessService;

    public MatFlowMaterialRegisterService(
            MatFlowMaterialRepository materialRepository,
            MatFlowStockBalanceRepository balanceRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowProcessingJobRepository processingJobRepository,
            MatFlowAccessService accessService) {
        this.materialRepository = materialRepository;
        this.balanceRepository = balanceRepository;
        this.ledgerRepository = ledgerRepository;
        this.processingJobRepository = processingJobRepository;
        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public MaterialRegisterResponse register(String plantCode, String search) {
        accessService.requireRead();
        String plant = cleanUpper(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);

        List<MatFlowStockLedger> ledger = ledgerRepository.findAll().stream()
                .filter(row -> row != null && row.material != null && row.location != null)
                .filter(row -> accessService.canAccessPlant(row.location.getPlantCode()))
                .filter(row -> plant == null || plant.equals(cleanUpper(row.location.getPlantCode())))
                .toList();

        List<MatFlowStockBalance> balances = balanceRepository.findAll().stream()
                .filter(row -> row != null && row.material != null && row.location != null)
                .filter(row -> accessService.canAccessPlant(row.location.getPlantCode()))
                .filter(row -> plant == null || plant.equals(cleanUpper(row.location.getPlantCode())))
                .toList();

        List<MatFlowProcessingJob> jobs = processingJobRepository.findAll().stream()
                .filter(job -> job != null && job.location != null && job.inputMaterial != null)
                .filter(job -> accessService.canAccessPlant(job.location.getPlantCode()))
                .filter(job -> plant == null || plant.equals(cleanUpper(job.location.getPlantCode())))
                .toList();

        List<MaterialRegisterRow> rows = materialRepository.findAll().stream()
                .filter(material -> matches(material, query))
                .map(material -> build(material, ledger, balances, jobs))
                .filter(row -> row.purchasedQty().compareTo(ZERO) != 0
                        || row.issuedQty().compareTo(ZERO) != 0
                        || row.consumedQty().compareTo(ZERO) != 0
                        || row.productionWastedQty().compareTo(ZERO) != 0
                        || row.processingWastedQty().compareTo(ZERO) != 0
                        || row.returnedQty().compareTo(ZERO) != 0
                        || row.onHandQty().compareTo(ZERO) != 0)
                .sorted(Comparator.comparing(MaterialRegisterRow::materialCode,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();

        return new MaterialRegisterResponse(LocalDateTime.now(), plant, rows);
    }

    private MaterialRegisterRow build(
            MatFlowMaterial material,
            List<MatFlowStockLedger> allLedger,
            List<MatFlowStockBalance> allBalances,
            List<MatFlowProcessingJob> allJobs) {
        UUID materialId = material.getId();
        List<MatFlowStockLedger> ledger = allLedger.stream()
                .filter(row -> materialId.equals(row.material.getId())).toList();
        List<MatFlowStockBalance> balances = allBalances.stream()
                .filter(row -> materialId.equals(row.material.getId())).toList();

        BigDecimal purchased = movementQuantity(ledger, MovementType.RECEIPT);
        BigDecimal issued = ledger.stream()
                .filter(row -> row.movementType == MovementType.ISSUE_TO_PRODUCTION)
                .map(row -> abs(row.reservedChange))
                .reduce(ZERO, BigDecimal::add);
        BigDecimal consumed = movementQuantity(ledger, MovementType.PRODUCTION_CONSUMPTION);
        BigDecimal productionWaste = ledger.stream()
                .filter(row -> row.movementType == MovementType.SCRAP)
                .filter(row -> "MATFLOW_PRODUCTION_WASTE".equals(row.referenceType))
                .map(row -> abs(row.quantityChange)).reduce(ZERO, BigDecimal::add);
        BigDecimal processingWaste = allJobs.stream()
                .filter(job -> job.inputMaterial != null && materialId.equals(job.inputMaterial.getId()))
                .map(job -> scale(job.wastageQty)).reduce(ZERO, BigDecimal::add);
        BigDecimal returned = movementQuantity(ledger, MovementType.MATERIAL_RETURN_IN);
        BigDecimal onHand = balances.stream().map(row -> scale(row.onHandQty)).reduce(ZERO, BigDecimal::add);
        BigDecimal available = balances.stream().map(row -> scale(row.availableQty())).reduce(ZERO, BigDecimal::add);
        LocalDateTime last = ledger.stream().map(row -> row.actionAt)
                .filter(value -> value != null).max(LocalDateTime::compareTo).orElse(null);

        return new MaterialRegisterRow(
                materialId, material.getMaterialCode(), material.getMaterialName(),
                material.getCategory(), material.getSpecification(), material.getUom(),
                purchased, issued, consumed, productionWaste, processingWaste,
                returned, onHand, available, last);
    }

    /** Physical flow quantity independent of sign convention in the ledger. */
    private BigDecimal movementQuantity(List<MatFlowStockLedger> ledger, MovementType type) {
        return ledger.stream().filter(row -> row.movementType == type)
                .map(row -> abs(row.quantityChange)).reduce(ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);
    }

    private boolean matches(MatFlowMaterial material, String query) {
        if (query == null || query.isBlank()) return true;
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
        if (value == null || value.trim().isBlank()) return null;
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
