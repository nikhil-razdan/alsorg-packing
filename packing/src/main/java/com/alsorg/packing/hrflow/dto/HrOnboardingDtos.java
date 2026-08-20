package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.HrOnboardingStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class HrOnboardingDtos {

    private HrOnboardingDtos() {}

    public record CreateOnboardingRequest(
            LocalDate joiningDate,
            String department,
            String designation,
            String location,
            String reportingManager,
            String appointedBy,
            String remarks
    ) {}

    public record UpdateOnboardingRequest(
            Long rowVersion,
            HrOnboardingStatus status,
            LocalDate joiningDate,
            String department,
            String designation,
            String location,
            String reportingManager,
            String appointedBy,
            String remarks
    ) {}

    public record ConfirmJoiningRequest(
            String employeeCode,
            LocalDate joiningDate,
            Boolean employeeAcknowledged
    ) {}

    public record OnboardingSummaryResponse(
            UUID id,
            UUID candidateId,
            String candidateNumber,
            String candidateName,
            HrOnboardingStatus status,
            LocalDate joiningDate,
            String department,
            String designation,
            String location,
            String reportingManager,
            UUID employeeId,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            long rowVersion
    ) {}

    public record OnboardingDetailResponse(
            UUID id,
            UUID candidateId,
            String candidateNumber,
            String candidateName,
            HrOnboardingStatus status,
            LocalDate joiningDate,
            String department,
            String designation,
            String location,
            String reportingManager,
            String appointedBy,
            String remarks,
            UUID employeeId,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            long rowVersion,
            HrDocumentDtos.DocumentCompletenessResponse documentCompleteness
    ) {}

    public record JoiningReportResponse(
            UUID id,
            UUID onboardingCaseId,
            UUID employeeId,
            UUID candidateId,
            String employeeCode,
            String employeeName,
            String fatherName,
            String designation,
            String department,
            LocalDate joiningDate,
            boolean employeeAcknowledged,
            LocalDateTime employeeAcknowledgedAt,
            String confirmedBy,
            LocalDateTime confirmedAt
    ) {}

    public record PortalLinkResponse(
            UUID onboardingCaseId,
            UUID candidateId,
            String candidateNumber,
            String token,
            LocalDateTime expiresAt
    ) {}

    /**
     * Generic versioned legal/policy snapshot. The actual source text is not hard-coded
     * in Java; HR publishes the approved version and the exact text is frozen here.
     */
    public record LegalSnapshotRequest(
            String version,
            String title,
            String body
    ) {}

    public record LegalSnapshotResponse(
            UUID documentId,
            String version,
            String title,
            String body,
            String snapshotSha256,
            String publishedBy,
            LocalDateTime publishedAt
    ) {}

    public record AcceptanceRequest(
            Boolean accepted,
            String typedName
    ) {}

    public record AgreementAcceptanceResponse(
            UUID documentId,
            String version,
            String title,
            String body,
            String snapshotSha256,
            String typedName,
            String acceptedBy,
            LocalDateTime acceptedAt,
            String verifiedBy,
            LocalDateTime verifiedAt
    ) {}

    public record OrientationTask(
            String code,
            String section,
            String label,
            boolean required,
            boolean completed,
            String completedBy,
            LocalDateTime completedAt,
            String remarks,
            LocalDate visitDate,
            String assistedBy
    ) {}

    public record OrientationTaskUpdate(
            String code,
            Boolean completed,
            String remarks,
            LocalDate visitDate,
            String assistedBy
    ) {}

    public record OrientationUpdateRequest(
            String expectedStateSha256,
            List<OrientationTaskUpdate> tasks
    ) {}

    public record OrientationAcknowledgeRequest(
            Boolean acknowledged,
            String typedName
    ) {}

    public record OrientationResponse(
            UUID stateDocumentId,
            String stateSha256,
            String version,
            List<OrientationTask> tasks,
            boolean allRequiredCompleted,
            boolean employeeAcknowledged,
            String employeeAcknowledgedName,
            LocalDateTime employeeAcknowledgedAt,
            LocalDateTime updatedAt
    ) {}

    public record FeedbackQuestion(
            String code,
            String question
    ) {}

    public record FeedbackAnswerRequest(
            String code,
            String answer,
            String suggestion
    ) {}

    public record FeedbackSubmissionRequest(
            List<FeedbackAnswerRequest> answers
    ) {}

    public record FeedbackAnswer(
            String code,
            String question,
            String answer,
            String suggestion
    ) {}

    public record FeedbackSubmissionResponse(
            UUID documentId,
            List<FeedbackAnswer> answers,
            String submittedBy,
            LocalDateTime submittedAt
    ) {}

    public record CompletionResponse(
            UUID onboardingCaseId,
            UUID candidateId,
            HrOnboardingStatus status,
            boolean complete,
            int completedChecks,
            int totalChecks,
            int percent,
            boolean requiredDocumentsComplete,
            boolean joiningReportAcknowledged,
            boolean policyAcknowledged,
            boolean orientationCompleted,
            boolean inductionFeedbackSubmitted,
            boolean ndaAccepted,
            boolean ndaVerified,
            boolean declarationAccepted,
            List<String> pending
    ) {}

    public record OnboardingPortalResponse(
            UUID onboardingCaseId,
            UUID candidateId,
            String candidateNumber,
            String candidateName,
            HrOnboardingStatus status,
            LocalDate joiningDate,
            String department,
            String designation,
            String location,
            String reportingManager,
            JoiningReportResponse joiningReport,
            LegalSnapshotResponse policy,
            AgreementAcceptanceResponse policyAcknowledgement,
            LegalSnapshotResponse nda,
            AgreementAcceptanceResponse ndaAcceptance,
            AgreementAcceptanceResponse ndaVerification,
            LegalSnapshotResponse declaration,
            AgreementAcceptanceResponse declarationAcceptance,
            OrientationResponse orientation,
            List<FeedbackQuestion> feedbackQuestions,
            FeedbackSubmissionResponse feedbackSubmission,
            CompletionResponse completion
    ) {}
}
