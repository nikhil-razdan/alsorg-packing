package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowApprovalAction;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Core MatFlow material and operational-BOM contracts. */
public final class MatFlowDtos {
    private MatFlowDtos() {
    }

    public record MaterialRequest(
            @Size(max = 100, message = "Material code cannot exceed 100 characters.") String materialCode,
            @Size(max = 300, message = "Material name cannot exceed 300 characters.") String materialName,
            @Size(max = 120, message = "Material category cannot exceed 120 characters.") String category,
            @Size(max = 2000, message = "Material specification cannot exceed 2000 characters.") String specification,
            @Size(max = 50, message = "UOM cannot exceed 50 characters.") String uom,
            @Size(max = 300, message = "Preferred supplier cannot exceed 300 characters.") String preferredSupplier,
            @DecimalMin(value = "0.0", inclusive = true, message = "Minimum stock cannot be negative.") BigDecimal minimumStock,
            @DecimalMin(value = "0.0", inclusive = true, message = "Reorder level cannot be negative.") BigDecimal reorderLevel,
            Boolean active,
            Long rowVersion) {
    }

    public record MaterialResponse(
            UUID id,
            String materialCode,
            String materialName,
            String category,
            String specification,
            String uom,
            String preferredSupplier,
            BigDecimal minimumStock,
            BigDecimal reorderLevel,
            boolean active,
            Long rowVersion,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt) {
    }

    /**
     * Compatibility Product/Drawing contract used inside BOM detail reads.
     * Canonical Project/Product writes belong to MatFlowProjectController.
     */
    public record ProjectDrawingRequest(
            @Size(max = 150, message = "Project code cannot exceed 150 characters.") String projectCode,
            @Size(max = 300, message = "Project name cannot exceed 300 characters.") String projectName,
            @Size(max = 300, message = "Client name cannot exceed 300 characters.") String clientName,
            @Size(max = 200, message = "Drawing number cannot exceed 200 characters.") String drawingNo,
            @Size(max = 100, message = "Drawing revision cannot exceed 100 characters.") String drawingRevision,
            @Size(max = 300, message = "Product name cannot exceed 300 characters.") String productName,
            @Size(max = 100, message = "Plant code cannot exceed 100 characters.") String plantCode,
            LocalDate requiredDate,
            @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks,
            Boolean active,
            Long rowVersion) {
    }

    public record ProjectDrawingResponse(
            UUID id,
            String projectCode,
            String projectName,
            String clientName,
            String drawingNo,
            String drawingRevision,
            String productName,
            String plantCode,
            LocalDate requiredDate,
            String remarks,
            boolean active,
            Long rowVersion,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt) {
    }

    public record BomCreateRequest(
            @NotNull(message = "Project product ID is required.") UUID projectDrawingId,
            @Size(max = 2000, message = "BOM remarks cannot exceed 2000 characters.") String remarks) {
    }

    public record BomUpdateRequest(
            UUID projectDrawingId,
            @Size(max = 2000, message = "BOM remarks cannot exceed 2000 characters.") String remarks,
            @NotNull(message = "BOM row version is required.") Long rowVersion) {
    }

    public record BomLineRequest(
            @NotNull(message = "Material is required.") UUID materialId,
            @NotNull(message = "Required quantity is required.")
            @DecimalMin(value = "0.001", inclusive = true, message = "Required quantity must be greater than zero.")
            BigDecimal requiredQty,
            @DecimalMin(value = "0.0", inclusive = true, message = "Wastage percent cannot be negative.")
            @DecimalMax(value = "1000.0", inclusive = true, message = "Wastage percent cannot exceed 1000.")
            BigDecimal wastagePercent,
            @Size(max = 1000, message = "BOM line remarks cannot exceed 1000 characters.") String remarks,
            Long rowVersion) {
    }

    public record BomActionRequest(
            @NotNull(message = "BOM row version is required.") Long rowVersion,
            @Size(max = 2000, message = "Action remarks cannot exceed 2000 characters.") String remarks) {
    }

    public record BomLineResponse(
            UUID id,
            Integer lineNo,
            UUID materialId,
            String materialCode,
            String materialName,
            String materialCategorySnapshot,
            String specification,
            String uom,
            BigDecimal requiredQty,
            BigDecimal wastagePercent,
            BigDecimal netRequiredQty,
            String remarks,
            Long rowVersion) {
    }

    public record ApprovalHistoryResponse(
            UUID id,
            MatFlowApprovalAction action,
            MatFlowBomStatus fromStatus,
            MatFlowBomStatus toStatus,
            String remarks,
            String actionBy,
            LocalDateTime actionAt) {
    }

    public record BomSummaryResponse(
            UUID id,
            String bomNumber,
            UUID revisionGroupId,
            Integer revisionNo,
            MatFlowBomStatus status,
            boolean latestRevision,
            boolean effective,
            UUID projectDrawingId,
            String projectCode,
            String projectName,
            String drawingNo,
            String drawingRevision,
            String productName,
            String clientName,
            String plantCode,
            int lineCount,
            String productionReviewedBy,
            LocalDateTime productionReviewedAt,
            String productionReviewRemarks,
            Long rowVersion,
            String updatedBy,
            LocalDateTime updatedAt) {
    }

    /**
     * Production review is the final operational BOM gate. The old generic
     * approvedBy/approvedAt mirror columns are intentionally not exposed.
     */
    public record BomDetailResponse(
            UUID id,
            String bomNumber,
            UUID revisionGroupId,
            Integer revisionNo,
            MatFlowBomStatus status,
            boolean latestRevision,
            boolean effective,
            ProjectDrawingResponse project,
            String remarks,
            String submittedBy,
            LocalDateTime submittedAt,
            String productionReviewedBy,
            LocalDateTime productionReviewedAt,
            String productionReviewRemarks,
            String returnedBy,
            LocalDateTime returnedAt,
            String returnRemarks,
            Long rowVersion,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            List<BomLineResponse> lines,
            List<ApprovalHistoryResponse> history) {
    }
}
