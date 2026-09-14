package com.alsorg.packing.controller.dto.matflow;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * API contract for the MatFlow Design -> Engineering -> Production handover
 * workspace. This is a human/document-control layer tied to the existing
 * Project/Product and BOM aggregates; it does not replace MatFlow material
 * execution.
 */
public final class MatFlowWorkspaceDtos {
    private MatFlowWorkspaceDtos() {}

    public record ChecklistItemUpdateRequest(
            Integer version,
            String state,
            String naReason,
            String remarks) {}

    public record ChecklistItemResponse(
            String key,
            int no,
            String text,
            boolean naAllowed,
            String state,
            String naReason,
            String remarks,
            String checkedBy,
            String checkedAt) {}

    public record ChecklistProgress(
            int total,
            int done,
            int notApplicable,
            int pending,
            int percent,
            boolean complete) {}

    public record DesignSubmissionCreateRequest(
            UUID projectId,
            UUID productId,
            String designer,
            String designDrawingRevision,
            String engineeringHead,
            String productionRecipient,
            String engineeringChecklistTemplateKey,
            String reference,
            String companyCode,
            String remarks) {}

    public record DesignSubmissionUpdateRequest(
            Integer version,
            String designer,
            String designDrawingRevision,
            String engineeringHead,
            String productionRecipient,
            String engineeringChecklistTemplateKey,
            String reference,
            String companyCode,
            String remarks) {}

    public record DesignSubmissionActionRequest(
            Integer version,
            String action,
            String assignedTo,
            String dueDate,
            String priority,
            String note) {}

    public record WorkspaceFileResponse(
            boolean available,
            String originalFileName,
            String contentType,
            Long sizeBytes,
            String revision,
            String uploadedBy,
            String uploadedAt) {}

    public record DesignSubmissionResponse(
            UUID id,
            String submissionNumber,
            String status,
            UUID projectId,
            UUID productId,
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            String productName,
            String drawingNo,
            String productMasterRevisionAtCreation,
            String designDrawingRevision,
            String designer,
            String engineeringHead,
            String productionRecipient,
            String engineeringChecklistTemplateKey,
            String reference,
            String companyCode,
            String remarks,
            String submittedBy,
            String submittedAt,
            String reviewedBy,
            String reviewedAt,
            String returnReason,
            UUID taskId,
            int version,
            String createdBy,
            String createdAt,
            String updatedBy,
            String updatedAt,
            WorkspaceFileResponse designDrawing,
            ChecklistProgress checklistProgress,
            List<ChecklistItemResponse> checklist) {}

    public record EngineeringTaskAssignRequest(
            Integer version,
            String assignedTo,
            String dueDate,
            String priority,
            String note) {}

    public record EngineeringTaskUpdateRequest(
            Integer version,
            String dueDate,
            String priority,
            String outstandingIssues,
            String remarks,
            String productionRecipient) {}

    public record EngineeringTaskStatusRequest(
            Integer version,
            String status,
            String note) {}

    public record EngineeringHandoverRequest(
            Integer version,
            UUID bomId,
            Long bomRowVersion,
            String handoverRemarks) {}

    public record LinkedBomResponse(
            UUID id,
            String bomNumber,
            Integer revisionNo,
            String status,
            boolean effective,
            String submittedBy,
            String submittedAt,
            String productionReviewedBy,
            String productionReviewedAt,
            String productionReviewRemarks,
            String returnedBy,
            String returnedAt,
            String returnRemarks,
            Long rowVersion) {}

    public record EngineeringTaskResponse(
            UUID id,
            String taskNumber,
            String status,
            String priority,
            UUID submissionId,
            UUID projectId,
            UUID productId,
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            String productName,
            String drawingNo,
            String designDrawingRevision,
            String engineeringDrawingRevision,
            String engineeringHead,
            String assignedTo,
            String productionRecipient,
            String dueDate,
            String startedAt,
            String outstandingIssues,
            String remarks,
            String handoverRemarks,
            String handedOverBy,
            String handedOverAt,
            boolean revisionReviewRequired,
            UUID pendingDesignSubmissionId,
            String pendingDesignRevision,
            String checklistTemplateKey,
            ChecklistProgress checklistProgress,
            List<ChecklistItemResponse> checklist,
            WorkspaceFileResponse designDrawing,
            WorkspaceFileResponse productionDrawing,
            LinkedBomResponse linkedBom,
            boolean productionReturnPending,
            boolean overdue,
            int version,
            String createdBy,
            String createdAt,
            String updatedBy,
            String updatedAt) {}

    public record WorkspaceHistoryRow(
            String action,
            String actor,
            String at,
            String status,
            String note) {}

    public record DesignSubmissionDetailResponse(
            DesignSubmissionResponse submission,
            List<WorkspaceHistoryRow> history) {}

    public record EngineeringTaskDetailResponse(
            EngineeringTaskResponse task,
            List<WorkspaceHistoryRow> history) {}

    public record WorkspacePerson(
            String username,
            String displayName,
            List<String> roles,
            List<String> plantCodes,
            boolean designUser,
            boolean engineeringHead,
            boolean engineer,
            boolean productionRecipient) {}

    public record ChecklistTemplateResponse(
            String key,
            String name,
            String area,
            boolean enabled,
            boolean mandatory,
            String description,
            int itemCount,
            List<Map<String, Object>> items) {}

    public record WorkspaceNotificationResponse(
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            String title,
            String status,
            String priority,
            String projectCode,
            String productName,
            String plantCode,
            String message,
            String updatedAt,
            String path,
            boolean read) {}

    public record WorkspaceNotificationFeedResponse(
            int unreadCount,
            List<WorkspaceNotificationResponse> notifications,
            String generatedAt) {}

    public record ProductEngineeringContextResponse(
            UUID projectId,
            UUID productId,
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            String productName,
            String drawingNo,
            String currentProductDrawingRevision,
            List<DesignSubmissionResponse> submissions,
            List<EngineeringTaskResponse> tasks,
            List<LinkedBomResponse> boms,
            String generatedAt) {}
}
