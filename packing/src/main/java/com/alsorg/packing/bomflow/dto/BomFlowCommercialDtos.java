package com.alsorg.packing.bomflow.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class BomFlowCommercialDtos {

    private BomFlowCommercialDtos() {
    }

    public record MaterialRateRequest(
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
            Boolean active,
            Long rowVersion) {
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
            Boolean active,
            Long rowVersion) {
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
            BigDecimal labourCount,
            BigDecimal workingHours,
            BigDecimal quantity,
            BigDecimal rate,
            String remarks,
            Long rowVersion) {
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

    public record CostingSettingsRequest(
            BigDecimal markupPercent,
            BigDecimal factoryFixedOverheadPercent,
            BigDecimal factoryVariableOverheadPercent,
            BigDecimal adminOverheadPercent,
            BigDecimal sellingOverheadPercent,
            BigDecimal profitPercent,
            BigDecimal franchisePercent,
            BigDecimal gstPercent,
            Boolean roundOff,
            Long rowVersion) {
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
