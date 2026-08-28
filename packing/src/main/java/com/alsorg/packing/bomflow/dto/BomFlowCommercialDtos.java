package com.alsorg.packing.bomflow.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class BomFlowCommercialDtos {

    private BomFlowCommercialDtos() {
    }

    public record MaterialRateRequest(
            @NotBlank @Size(max = 120) String category,
            @NotBlank @Size(max = 500) String itemName,
            @Size(max = 255) String brand,
            @Size(max = 220) String vendorName,
            @NotBlank @Size(max = 60) String unit,
            @Size(max = 40) String rateType,
            @DecimalMin("0.0") BigDecimal rate,
            @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal gstPercent,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            @Size(max = 1000) String sourceReference,
            @Size(max = 3000) String notes,
            Boolean active,
            @PositiveOrZero Long rowVersion) {
    }

    public record MaterialRateResponse(
            UUID id,
            String category,
            String itemName,
            String brand,
            String vendorName,
            String unit,
            String rateType,
            BigDecimal rate,
            BigDecimal gstPercent,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String sourceReference,
            String notes,
            boolean hasEvidence,
            String evidenceFileName,
            String evidenceContentType,
            Long evidenceSize,
            String evidenceUploadedBy,
            LocalDateTime evidenceUploadedAt,
            boolean active,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }

    public record LabourRateRequest(
            @NotBlank @Size(max = 160) String department,
            @Size(max = 100) String processCode,
            @NotBlank @Size(max = 220) String processName,
            @Size(max = 40) String basis,
            @Size(max = 60) String unit,
            @DecimalMin("0.0") BigDecimal rate,
            @DecimalMin("0.0") BigDecimal defaultLabourCount,
            @DecimalMin("0.0") BigDecimal defaultWorkingHours,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            @Size(max = 3000) String notes,
            Boolean active,
            @PositiveOrZero Long rowVersion) {
    }

    public record LabourRateResponse(
            UUID id,
            String department,
            String processCode,
            String processName,
            String basis,
            String unit,
            BigDecimal rate,
            BigDecimal defaultLabourCount,
            BigDecimal defaultWorkingHours,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String notes,
            boolean active,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }

    public record LabourLineRequest(
            UUID labourRateId,
            @Size(max = 40) String basis,
            @Size(max = 60) String unit,
            @DecimalMin("0.0") BigDecimal labourCount,
            @DecimalMin("0.0") BigDecimal workingHours,
            @DecimalMin("0.0") BigDecimal quantity,
            @DecimalMin("0.0") BigDecimal rate,
            @Size(max = 3000) String remarks,
            @PositiveOrZero Long rowVersion) {
    }

    public record LabourLineResponse(
            UUID id,
            UUID revisionId,
            UUID labourRateId,
            String department,
            String processCode,
            String processName,
            String basis,
            String unit,
            BigDecimal labourCount,
            BigDecimal workingHours,
            BigDecimal quantity,
            BigDecimal rate,
            BigDecimal amount,
            String remarks,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }

    public record LabourSyncResponse(
            UUID revisionId,
            int activeMasterRates,
            int matchedMasterRates,
            int insertedLines,
            int existingLines,
            int unmatchedMasterRates,
            int incompleteLines,
            List<String> matchedProcesses,
            List<String> unmatchedProcesses,
            String message) {
    }

    public record CostingSettingsRequest(
            @DecimalMin("0.0") @DecimalMax("1000.0") BigDecimal markupPercent,
            @DecimalMin("0.0") @DecimalMax("1000.0") BigDecimal factoryFixedOverheadPercent,
            @DecimalMin("0.0") @DecimalMax("1000.0") BigDecimal factoryVariableOverheadPercent,
            @DecimalMin("0.0") @DecimalMax("1000.0") BigDecimal adminOverheadPercent,
            @DecimalMin("0.0") @DecimalMax("1000.0") BigDecimal sellingOverheadPercent,
            @DecimalMin("0.0") @DecimalMax("1000.0") BigDecimal profitPercent,
            @DecimalMin("0.0") @DecimalMax("1000.0") BigDecimal franchisePercent,
            @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal gstPercent,
            Boolean roundOff,
            @PositiveOrZero Long rowVersion) {
    }

    public record CostingSettingsResponse(
            UUID id,
            UUID revisionId,
            BigDecimal markupPercent,
            BigDecimal factoryFixedOverheadPercent,
            BigDecimal factoryVariableOverheadPercent,
            BigDecimal adminOverheadPercent,
            BigDecimal sellingOverheadPercent,
            BigDecimal profitPercent,
            BigDecimal franchisePercent,
            BigDecimal gstPercent,
            boolean roundOff,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }

    public record MaterialCostLineResponse(
            UUID id,
            Integer lineNo,
            String section,
            String category,
            String itemName,
            String brand,
            String vendorName,
            String unit,
            BigDecimal quantity,
            BigDecimal rate,
            BigDecimal materialAmount,
            BigDecimal processingAmount,
            BigDecimal totalAmount,
            BigDecimal gstPercent,
            UUID rateMasterId,
            LocalDateTime rateAppliedAt) {
    }

    public record CostingSummaryResponse(
            UUID revisionId,
            UUID productId,
            String productName,
            String productCode,
            String projectReference,
            String clientEntity,
            Integer revisionNo,
            String revisionStatus,
            BigDecimal directMaterial,
            BigDecimal directLabour,
            BigDecimal directCost,
            BigDecimal markupAmount,
            BigDecimal primeCost,
            BigDecimal factoryFixedOverhead,
            BigDecimal factoryVariableOverhead,
            BigDecimal factoryCost,
            BigDecimal adminOverhead,
            BigDecimal sellingOverhead,
            BigDecimal costPerProduct,
            BigDecimal profitAmount,
            BigDecimal exFactory,
            BigDecimal franchiseAmount,
            BigDecimal taxableValue,
            BigDecimal gstAmount,
            BigDecimal mrp,
            int materialItemCount,
            int missingMaterialRates,
            int labourLineCount,
            CostingSettingsResponse settings,
            List<MaterialCostLineResponse> materialLines,
            List<LabourLineResponse> labourLines) {
    }

    public record RevisionCostPointResponse(
            UUID revisionId,
            Integer revisionNo,
            String status,
            BigDecimal directMaterial,
            BigDecimal directLabour,
            BigDecimal costPerProduct,
            BigDecimal profitAmount,
            BigDecimal exFactory,
            BigDecimal mrp,
            LocalDateTime updatedAt) {
    }

    public record MaterialVarianceResponse(
            String key,
            String itemName,
            String section,
            String unit,
            BigDecimal previousQuantity,
            BigDecimal currentQuantity,
            BigDecimal previousRate,
            BigDecimal currentRate,
            BigDecimal previousAmount,
            BigDecimal currentAmount,
            BigDecimal deltaAmount,
            BigDecimal deltaPercent,
            String changeType) {
    }

    public record LabourVarianceResponse(
            String key,
            String department,
            String processName,
            String previousBasis,
            String currentBasis,
            BigDecimal previousLabourCount,
            BigDecimal currentLabourCount,
            BigDecimal previousWorkingHours,
            BigDecimal currentWorkingHours,
            BigDecimal previousQuantity,
            BigDecimal currentQuantity,
            BigDecimal previousRate,
            BigDecimal currentRate,
            BigDecimal previousAmount,
            BigDecimal currentAmount,
            BigDecimal deltaAmount,
            BigDecimal deltaPercent,
            String changeType) {
    }

    public record RevisionComparisonResponse(
            UUID productId,
            UUID currentRevisionId,
            Integer currentRevisionNo,
            String currentStatus,
            UUID previousRevisionId,
            Integer previousRevisionNo,
            String previousStatus,
            boolean hasPreviousRevision,
            BigDecimal directMaterialDelta,
            BigDecimal directLabourDelta,
            BigDecimal directCostDelta,
            BigDecimal costPerProductDelta,
            BigDecimal costPerProductDeltaPercent,
            BigDecimal configuredProfitDelta,
            BigDecimal exFactoryDelta,
            BigDecimal mrpDelta,
            BigDecimal mrpDeltaPercent,
            BigDecimal profitAtPreviousExFactory,
            BigDecimal profitImpactAtPreviousPrice,
            BigDecimal marginAtPreviousPricePercent,
            BigDecimal requiredExFactoryIncrease,
            String overallDirection,
            List<MaterialVarianceResponse> materialChanges,
            List<LabourVarianceResponse> labourChanges,
            List<RevisionCostPointResponse> history) {
    }

    public record RateApplyResponse(
            UUID revisionId,
            int totalRows,
            int matchedRows,
            int unmatchedRows,
            List<String> unmatchedItems,
            BigDecimal revisedMaterialTotal,
            String message) {
    }

    public record DashboardRecentResponse(
            UUID productId,
            UUID revisionId,
            String productName,
            String productCode,
            String status,
            BigDecimal materialCost,
            BigDecimal labourCost,
            BigDecimal currentCost,
            String updatedBy,
            LocalDateTime updatedAt) {
    }

    public record DashboardSummaryResponse(
            long totalProducts,
            long activeCostings,
            long draftBoms,
            long approvedBoms,
            long missingRates,
            long activeMaterialRates,
            long activeLabourRates,
            List<DashboardRecentResponse> recentCostings) {
    }
}
