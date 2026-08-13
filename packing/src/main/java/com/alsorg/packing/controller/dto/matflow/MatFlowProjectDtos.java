package com.alsorg.packing.controller.dto.matflow;

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

    public record ProductRequest(
            String productName,
            String drawingNo,
            String drawingRevision,
            LocalDate requiredDate,
            String remarks,
            Boolean active,
            Long rowVersion) {
    }

    /**
     * Administrative Product row: identity + latest BOM readiness only.
     * Material execution/shortage/quantity metrics belong to the tracker.
     */
    public record ProductPortfolioRow(
            UUID id,
            String productName,
            String drawingNo,
            String drawingRevision,
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
