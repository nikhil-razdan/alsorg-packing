package com.alsorg.packing.controller.dto.matflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
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
            @Size(max = 150, message = "Project code cannot exceed 150 characters.") String projectCode,
            @Size(max = 300, message = "Project name cannot exceed 300 characters.") String projectName,
            @Size(max = 300, message = "Client name cannot exceed 300 characters.") String clientName,
            @Size(max = 100, message = "Plant code cannot exceed 100 characters.") String plantCode,
            LocalDate requiredDate,
            @Size(max = 80, message = "Priority cannot exceed 80 characters.") String priority,
            @Size(max = 200, message = "Project manager cannot exceed 200 characters.") String projectManager,
            @Size(max = 2000, message = "Project remarks cannot exceed 2000 characters.") String remarks,
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
            @Size(max = 300, message = "Product name cannot exceed 300 characters.") String productName,
            @Size(max = 200, message = "Drawing number cannot exceed 200 characters.") String drawingNo,
            @Size(max = 100, message = "Drawing revision cannot exceed 100 characters.") String drawingRevision,
            @DecimalMin(value = "0.001", inclusive = true, message = "Length must be greater than zero.") BigDecimal dimensionLength,
            @DecimalMin(value = "0.001", inclusive = true, message = "Breadth must be greater than zero.") BigDecimal dimensionBreadth,
            @DecimalMin(value = "0.001", inclusive = true, message = "Height must be greater than zero.") BigDecimal dimensionHeight,
            LocalDate requiredDate,
            @Size(max = 2000, message = "Product remarks cannot exceed 2000 characters.") String remarks,
            Boolean active,
            Long rowVersion) {
    }

    /** Transactional multi-product creation for one Project/PD No. */
    public record ProductBulkCreateRequest(
            @NotEmpty(message = "At least one Product is required.")
            @Size(max = 500, message = "A maximum of 500 Products can be created at once.")
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
