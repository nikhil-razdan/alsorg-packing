package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProjectProductApprovalStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** API contract for the Project -> Products portfolio aggregate. */
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

    public record ProductApprovalRequest(
            Long rowVersion,
            String remarks) {
    }

    public record ProductPortfolioRow(
            UUID id,
            String productName,
            String drawingNo,
            String drawingRevision,
            LocalDate requiredDate,
            ProjectProductApprovalStatus approvalStatus,
            String approvedBy,
            LocalDateTime approvedAt,
            String returnedBy,
            LocalDateTime returnedAt,
            String approvalRemarks,
            boolean active,
            UUID latestBomId,
            String latestBomNumber,
            Integer latestBomRevision,
            String latestBomStatus,
            boolean bomEffective,
            UUID latestRequisitionId,
            String latestRequisitionNumber,
            String requisitionStatus,
            String currentDepartment,
            BigDecimal requestedQty,
            BigDecimal reservedQty,
            BigDecimal shortageQty,
            BigDecimal issuedQty,
            BigDecimal consumedQty,
            Long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {
    }

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
            int approvedProductCount,
            int completedProductCount,
            int shortageProductCount,
            BigDecimal materialCoveragePercent,
            String currentDepartment,
            String health,
            Long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<ProductPortfolioRow> products) {
    }
}
