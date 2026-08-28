package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.HrOnboardingStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class HrOnboardingDtos {

    private HrOnboardingDtos() {
    }

    public record CreateOnboardingRequest(
            LocalDate joiningDate,
            @Size(max = 160) String department,
            @Size(max = 160) String designation,
            @Size(max = 220) String location,
            @Size(max = 180) String reportingManager,
            @Size(max = 180) String appointedBy,
            @Size(max = 2000) String remarks
    ) {
    }

    public record UpdateOnboardingRequest(
            @PositiveOrZero Long rowVersion,
            HrOnboardingStatus status,
            LocalDate joiningDate,
            @Size(max = 160) String department,
            @Size(max = 160) String designation,
            @Size(max = 220) String location,
            @Size(max = 180) String reportingManager,
            @Size(max = 180) String appointedBy,
            @Size(max = 2000) String remarks
    ) {
    }

    public record ConfirmJoiningRequest(
            @Size(max = 80) String employeeCode,
            LocalDate joiningDate,
            Boolean employeeAcknowledged
    ) {
    }

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
    ) {
    }

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
    ) {
    }

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
    ) {
    }

    public record PortalLinkResponse(
            UUID onboardingCaseId,
            UUID candidateId,
            String candidateNumber,
            String token,
            LocalDateTime expiresAt
    ) {
    }

    public record LegalSnapshotRequest(
            @Size(max = 100) String version,
            @Size(max = 500) String title,
            @Size(max = 100_000) String body
    ) {
    }

    public record LegalSnapshotResponse(
            UUID documentId,
            String version,
            String title,
            String body,
            String snapshotSha256,
            String publishedBy,
            LocalDateTime publishedAt
    ) {
    }

    public record AcceptanceRequest(
            Boolean accepted,
            @Size(max = 180) String typedName
    ) {
    }

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
    ) {
    }

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
    ) {
    }

    public record OrientationTaskUpdate(
            @Size(max = 40) String code,
            Boolean completed,
            @Size(max = 2000) String remarks,
            LocalDate visitDate,
            @Size(max = 180) String assistedBy
    ) {
    }

    public record OrientationUpdateRequest(
            @Size(max = 64) String expectedStateSha256,
            @Valid @Size(max = 100) List<OrientationTaskUpdate> tasks
    ) {
    }

    public record OrientationAcknowledgeRequest(
            Boolean acknowledged,
            @Size(max = 180) String typedName
    ) {
    }

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
    ) {
    }

    public record FeedbackQuestion(
            String code,
            String question
    ) {
    }

    public record FeedbackAnswerRequest(
            @Size(max = 40) String code,
            @Size(max = 10) String answer,
            @Size(max = 4000) String suggestion
    ) {
    }

    public record FeedbackSubmissionRequest(
            @Valid @Size(max = 50) List<FeedbackAnswerRequest> answers
    ) {
    }

    public record FeedbackAnswer(
            String code,
            String question,
            String answer,
            String suggestion
    ) {
    }

    public record FeedbackSubmissionResponse(
            UUID documentId,
            List<FeedbackAnswer> answers,
            String submittedBy,
            LocalDateTime submittedAt
    ) {
    }

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
    ) {
    }

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
    ) {
    }
}
