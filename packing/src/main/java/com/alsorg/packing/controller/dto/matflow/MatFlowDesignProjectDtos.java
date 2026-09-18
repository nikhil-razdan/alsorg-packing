package com.alsorg.packing.controller.dto.matflow;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * PD / Project level Design workspace contract.
 *
 * One Project owns one Production File. Products are Design subtasks inside that
 * shared file and therefore do not expose independent Production File identities.
 */
public final class MatFlowDesignProjectDtos {
    private MatFlowDesignProjectDtos() {}

    public record AssignmentRequest(
            String assignedJunior,
            LocalDateTime dueAt,
            String brief,
            Long rowVersion) {}

    public record ChecklistUpdateRequest(
            String status,
            String remarks,
            Long rowVersion) {}

    public record ChecklistLockRequest(
            boolean locked,
            String note,
            Long rowVersion) {}

    public record ProductProgressRequest(
            String status,
            String note,
            Long rowVersion) {}

    public record LogRequest(
            String message,
            String kind,
            Long rowVersion) {}

    public record ChecklistItemResponse(
            String key,
            String section,
            String title,
            String criticality,
            boolean blocking,
            String status,
            String remarks,
            String completedBy,
            LocalDateTime completedAt) {}

    public record ProductSubtaskResponse(
            UUID productId,
            String productName,
            String productType,
            String drawingNo,
            String drawingRevision,
            Integer unitQuantity,
            java.math.BigDecimal dimensionLength,
            java.math.BigDecimal dimensionBreadth,
            java.math.BigDecimal dimensionHeight,
            String dimensionUom,
            String dimensions,
            LocalDate requiredDate,
            String productRemarks,
            String status,
            String note,
            String updatedBy,
            LocalDateTime progressUpdatedAt,
            Long rowVersion) {}

    public record ActivityLogResponse(
            UUID id,
            String kind,
            String message,
            String actor,
            LocalDateTime at) {}

    public record DesignProjectResponse(
            UUID projectId,
            String projectCode,
            boolean pdNumberPending,
            String projectName,
            String clientName,
            String plantCode,
            LocalDate tentativeCompletionDate,
            String priority,
            String projectManager,
            String designHead,
            boolean workflowEnabled,
            String assignedJunior,
            String assignedBy,
            LocalDateTime assignedAt,
            LocalDateTime dueAt,
            String brief,
            String status,
            boolean overdue,
            boolean checklistLocked,
            String checklistLockedBy,
            LocalDateTime checklistLockedAt,
            int checklistTotal,
            int checklistComplete,
            int checklistNotApplicable,
            int checklistPending,
            int checklistPercent,
            boolean checklistReadyForHandoff,
            int productCount,
            int productDone,
            List<ChecklistItemResponse> checklist,
            List<ProductSubtaskResponse> products,
            List<ActivityLogResponse> logs,
            List<String> handoffBlockers,
            UUID productionFileId,
            String productionFileNo,
            String productionFileStage,
            String releaseHealth,
            String ppcOwner,
            Long productionFileRowVersion,
            Long rowVersion,
            LocalDateTime updatedAt) {}
}
