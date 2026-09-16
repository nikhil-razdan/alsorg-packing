package com.alsorg.packing.controller.dto.matflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowWorkspaceDtos {
    private MatFlowWorkspaceDtos() {}

    public record ProductionFileSetupRequest(
            @Size(max = 150) String designer,
            @Size(max = 150) String designHead,
            @Size(max = 150) String ppcOwner,
            @Size(max = 150) String engineeringHead,
            @Size(max = 150) String assignedEngineer,
            LocalDate plannedProductionReleaseDate,
            LocalDate plannedDispatchDate,
            @Size(max = 4000) String remarks,
            Long rowVersion) {}

    public record ChecklistUpdateRequest(
            @NotBlank String status,
            @Size(max = 2000) String remarks,
            Long rowVersion) {}

    public record DesignTaskCreateRequest(
            @NotBlank @Size(max = 40) String taskType,
            @NotBlank @Size(max = 300) String title,
            @Size(max = 6000) String description,
            @NotEmpty @Size(max = 12) List<@NotBlank @Size(max = 150) String> assignees,
            LocalDateTime receivedAt,
            LocalDateTime dueAt,
            @Size(max = 20) String priority,
            Boolean blocking,
            @Size(max = 3000) String remarks) {}

    public record DesignTaskUpdateRequest(
            @Size(max = 40) String taskType,
            @Size(max = 300) String title,
            @Size(max = 6000) String description,
            @Size(max = 12) List<@NotBlank @Size(max = 150) String> assignees,
            LocalDateTime receivedAt,
            LocalDateTime dueAt,
            @Size(max = 20) String priority,
            Boolean blocking,
            @Size(max = 3000) String remarks,
            Long rowVersion) {}

    public record DesignTaskStatusRequest(
            @NotBlank String status,
            @Size(max = 3000) String note,
            Long rowVersion) {}

    public record DesignHeadReviewRequest(
            @NotBlank String decision,
            @Size(max = 4000) String remarks,
            Long rowVersion) {}

    public record DesignSubmitRequest(
            @Size(max = 4000) String controlledReleaseReason,
            Long rowVersion) {}

    public record GateDecisionRequest(
            @NotBlank String decision,
            @Size(max = 4000) String remarks,
            @Size(max = 150) String assignedTo,
            Long rowVersion) {}

    public record EngineeringDecisionRequest(
            @NotBlank String decision,
            @Size(max = 4000) String remarks,
            Long rowVersion) {}

    public record QueryCreateRequest(
            @NotBlank @Size(max = 300) String title,
            @NotBlank @Size(max = 6000) String description,
            @NotBlank @Size(max = 150) String assignedTo,
            LocalDateTime dueAt,
            @Size(max = 20) String priority) {}

    public record QueryResponseRequest(
            @NotBlank @Size(max = 6000) String response,
            Long rowVersion) {}

    public record QueryCloseRequest(
            @Size(max = 3000) String note,
            Long rowVersion) {}

    public record TaskCreateRequest(
            @NotBlank @Size(max = 120) String taskKey,
            @NotBlank @Size(max = 300) String title,
            @Size(max = 150) String assignedTo,
            LocalDateTime dueAt,
            @Size(max = 20) String priority,
            Boolean blocking,
            @Size(max = 3000) String description) {}

    public record TaskUpdateRequest(
            @Size(max = 150) String assignedTo,
            LocalDateTime dueAt,
            @Size(max = 20) String priority,
            @Size(max = 3000) String remarks,
            Long rowVersion) {}

    public record TaskStatusRequest(
            @NotBlank String status,
            @Size(max = 3000) String note,
            Long rowVersion) {}

    public record RevisionImpactRequest(
            @NotBlank String decision,
            @Size(max = 6000) String impactNote,
            Long rowVersion) {}

    public record WorkItemResponse(
            UUID id,
            String type,
            String key,
            String section,
            String title,
            String description,
            String criticality,
            boolean blocking,
            int displayOrder,
            String status,
            String assignedTo,
            LocalDateTime dueAt,
            LocalDateTime startedAt,
            String revisionContext,
            String priority,
            String responseText,
            String remarks,
            String completionNote,
            String completedBy,
            LocalDateTime completedAt,
            String respondedBy,
            LocalDateTime respondedAt,
            String closedBy,
            LocalDateTime closedAt,
            Long rowVersion,
            LocalDateTime updatedAt) {}

    public record DesignTaskResponse(
            UUID id,
            String taskNo,
            String taskType,
            String title,
            String description,
            String designer1,
            String assignedBy,
            List<String> assignees,
            String status,
            String priority,
            boolean blocking,
            LocalDateTime receivedAt,
            LocalDateTime dueAt,
            LocalDateTime startedAt,
            LocalDateTime completedAt,
            String completedBy,
            String holdReason,
            String remarks,
            Long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {}

    public record DesignTaskQueueResponse(
            DesignTaskResponse task,
            UUID productionFileId,
            String productionFileNo,
            String projectCode,
            String projectName,
            String clientName,
            String productName,
            String drawingNo,
            String stage,
            String releaseHealth,
            String designHead) {}

    public record DesignTaskProgress(
            int total,
            int needToStart,
            int assigned,
            int working,
            int hold,
            int done,
            int cancelled,
            int overdue,
            int percent) {}

    public record ChecklistProgress(
            int total,
            int complete,
            int notApplicable,
            int pending,
            int criticalPending,
            int requiredPending,
            int percent) {}

    public record RevisionResponse(
            UUID id,
            String type,
            String revisionNo,
            String status,
            String originalFileName,
            String contentType,
            long sizeBytes,
            String changeSummary,
            String impactNote,
            String impactReviewedBy,
            LocalDateTime impactReviewedAt,
            LocalDateTime activatedAt,
            Long rowVersion,
            LocalDateTime createdAt) {}

    public record AuditEventResponse(
            String entityType,
            UUID entityId,
            String action,
            String actor,
            LocalDateTime at,
            String detailsJson) {}

    public record ProductionFileResponse(
            UUID id,
            String productionFileNo,
            UUID projectId,
            UUID productId,
            String projectCode,
            String projectName,
            String clientName,
            String productName,
            String drawingNo,
            String plantCode,
            String stage,
            String releaseHealth,
            String engineeringDecision,
            String currentDepartment,
            String currentOwner,
            String designer,
            String designHead,
            String designHeadDecision,
            String designHeadReviewedBy,
            LocalDateTime designHeadReviewedAt,
            String designHeadRemarks,
            String ppcOwner,
            String engineeringHead,
            String assignedEngineer,
            String controlledReleaseReason,
            LocalDate plannedProductionReleaseDate,
            LocalDate plannedDispatchDate,
            String ppcGate1Decision,
            String ppcGate2Decision,
            boolean revisionReviewRequired,
            String downstreamWorkflowKey,
            String downstreamWorkflowStatus,
            LocalDateTime productionReleasedAt,
            String packFlowProjectKey,
            ChecklistProgress designChecklistProgress,
            DesignTaskProgress designTaskProgress,
            ChecklistProgress engineeringChecklistProgress,
            int openQueryCount,
            int pendingTaskCount,
            int completedTaskCount,
            UUID latestBomId,
            String latestBomStatus,
            Long rowVersion,
            LocalDateTime updatedAt) {}

    public record ProductionFileDetailResponse(
            ProductionFileResponse productionFile,
            List<WorkItemResponse> designChecklist,
            List<DesignTaskResponse> designTasks,
            List<WorkItemResponse> engineeringChecklist,
            List<WorkItemResponse> queries,
            List<WorkItemResponse> engineeringTasks,
            List<RevisionResponse> revisions,
            List<AuditEventResponse> timeline,
            boolean designHandoffReady,
            List<String> designHandoffBlockers,
            boolean ppcGate2Ready,
            List<String> ppcGate2Blockers) {}

    public record NotificationResponse(
            String referenceType,
            UUID referenceId,
            String title,
            String message,
            String priority,
            LocalDateTime dueAt,
            String projectCode,
            String productionFileNo,
            String path,
            boolean read) {}

    public record NotificationFeedResponse(
            int unreadCount,
            List<NotificationResponse> notifications,
            LocalDateTime generatedAt) {}
}
