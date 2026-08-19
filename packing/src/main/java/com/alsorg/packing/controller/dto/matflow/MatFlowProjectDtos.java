package com.alsorg.packing.controller.dto.matflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** API contract for the approval-free Project -> Products aggregate. */
public final class MatFlowProjectDtos {
    private MatFlowProjectDtos() {
    }

    public record ProjectRequest(
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            LocalDate requiredDate,
            String priority,
            String projectManager,
            String remarks,
            Boolean active,
            Long rowVersion) {
    }

    /**
     * Product dimensions are optional during early Engineering setup, but when
     * supplied they are treated as one complete L x B x H set. MatFlow stores
     * the three values separately so they remain searchable/auditable while the
     * UI presents them as one Dimensions field. The current business unit is MM.
     */
    public record ProductRequest(
            String productName,
            String drawingNo,
            String drawingRevision,
            BigDecimal dimensionLength,
            BigDecimal dimensionBreadth,
            BigDecimal dimensionHeight,
            LocalDate requiredDate,
            String remarks,
            Boolean active,
            Long rowVersion) {
    }

    /** Transactional multi-product creation for one Project/PD No. */
    public record ProductBulkCreateRequest(
            @NotEmpty(message = "At least one Product is required.")
            List<@Valid ProductRequest> products) {
    }

    /**
     * Administrative Product row: identity + dimensions + latest BOM readiness
     * only. Material execution/shortage/quantity metrics belong to the tracker.
     */
    public record ProductPortfolioRow(
            UUID id,
            String productName,
            String drawingNo,
            String drawingRevision,
            BigDecimal dimensionLength,
            BigDecimal dimensionBreadth,
            BigDecimal dimensionHeight,
            String dimensionUom,
            String dimensions,
            LocalDate requiredDate,
            boolean active,
            UUID latestBomId,
            String latestBomNumber,
            Integer latestBomRevision,
            String latestBomStatus,
            boolean bomEffective,
            String currentDepartment,
            Long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {
    }

    /** Project master response intentionally stays small and non-duplicative. */
    public record ProjectPortfolioResponse(
            UUID id,
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            LocalDate requiredDate,
            String priority,
            String projectManager,
            String remarks,
            boolean active,
            int productCount,
            String currentDepartment,
            String health,
            Long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<ProductPortfolioRow> products) {
    }
}
