package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class HrCandidateDtos {

    private HrCandidateDtos() {
    }

    public record FamilyMemberRequest(
            @Size(max = 160) String name,
            @Size(max = 100) String relation,
            LocalDate dateOfBirth,
            Boolean dependent
    ) {
    }

    public record EducationRequest(
            @Size(max = 160) String examination,
            @Size(max = 200) String boardOrUniversity,
            @Min(1900) @Max(2200) Integer year,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal marksPercent
    ) {
    }

    public record EmploymentRequest(
            @Size(max = 220) String companyName,
            @Size(max = 160) String designation,
            LocalDate fromDate,
            LocalDate toDate,
            @Size(max = 160) String hrName,
            @Size(max = 80) String hrContact,
            @DecimalMin("0.00") BigDecimal lastSalary,
            @Size(max = 600) String reasonForLeaving
    ) {
    }

    public record LanguageRequest(
            @Size(max = 100) String language,
            Boolean canRead,
            Boolean canWrite,
            Boolean canSpeak
    ) {
    }

    public record CreateCandidateRequest(
            @NotNull HrApplicationType applicationType,
            @Size(max = 180) String fullName,
            @Email @Size(max = 220) String email,
            @Size(max = 40) String mobileNo,
            @Size(max = 180) String postAppliedFor,
            @Size(max = 160) String department,
            @Size(max = 160) String designation,
            @Size(max = 180) String hrOwner
    ) {
    }

    /**
     * Draft requests intentionally remain partially optional. Phase 3A adds
     * size/range boundaries without turning the existing draft workflow into
     * a mandatory-field workflow. Submission requirements remain in the service.
     */
    public record CandidateApplicationRequest(
            @PositiveOrZero Long rowVersion,
            HrApplicationType applicationType,
            @Size(max = 180) String fullName,
            @Size(max = 180) String fatherOrHusbandName,
            HrMaritalStatus maritalStatus,
            HrGender gender,
            LocalDate dateOfBirth,
            @Email @Size(max = 220) String email,
            @Size(max = 40) String mobileNo,
            @Size(max = 180) String postAppliedFor,
            @Size(max = 1000) String workExperienceSummary,
            @Size(max = 1000) String educationalQualificationSummary,
            Boolean previousAlsorgExperience,
            @Size(max = 1000) String previousAlsorgExperienceDetails,
            Boolean familyMemberWorkedAtAlsorg,
            @Size(max = 1000) String familyMemberWorkedAtAlsorgDetails,
            @Size(max = 160) String vaccination,
            @Size(max = 1500) String presentAddress,
            @Size(max = 1500) String permanentAddress,
            @Size(max = 64) String aadhaarNo,
            @Size(max = 64) String panNo,
            @Size(max = 100) String nationality,
            @Size(max = 100) String religion,
            @Size(max = 100) String drivingLicenseNo,
            @Size(max = 40) String familyContactNo,
            @Size(max = 180) String referenceName,
            @DecimalMin("0.00") BigDecimal salaryDrawn,
            @DecimalMin("0.00") BigDecimal salaryExpected,
            @Size(max = 1500) String extracurricularActivities,
            @Size(max = 1500) String hobbies,
            @Size(max = 1500) String awardsAppreciations,
            @Size(max = 3000) String organizationChartNote,
            Boolean declarationAccepted,
            @Valid @Size(max = 50) List<FamilyMemberRequest> familyMembers,
            @Valid @Size(max = 50) List<EducationRequest> educations,
            @Valid @Size(max = 50) List<EmploymentRequest> employments,
            @Valid @Size(max = 25) List<LanguageRequest> languages
    ) {
    }

    public record HrCandidateUpdateRequest(
            @PositiveOrZero Long rowVersion,
            @Size(max = 180) String fullName,
            @Email @Size(max = 220) String email,
            @Size(max = 40) String mobileNo,
            @Size(max = 180) String postAppliedFor,
            @DecimalMin("0.00") BigDecimal salaryApproved,
            LocalDate proposedJoiningDate,
            @Size(max = 160) String department,
            @Size(max = 160) String designation,
            @Size(max = 180) String appointedBy,
            @Size(max = 180) String hrOwner
    ) {
    }

    public record ChangeStageRequest(
            @NotNull HrCandidateStage stage,
            @Size(max = 2000) String remarks
    ) {
    }

    public record ApplicationLinkResponse(
            UUID candidateId,
            String candidateNumber,
            String token,
            LocalDateTime expiresAt
    ) {
    }

    public record CandidateSummaryResponse(
            UUID id,
            String candidateNumber,
            HrApplicationType applicationType,
            HrCandidateStage stage,
            String fullName,
            String email,
            String mobileNo,
            String postAppliedFor,
            String department,
            String designation,
            String hrOwner,
            LocalDate proposedJoiningDate,
            LocalDateTime createdAt,
            LocalDateTime lastSubmittedAt,
            long rowVersion
    ) {
    }

    public record CandidateDetailResponse(
            UUID id,
            String candidateNumber,
            HrApplicationType applicationType,
            HrCandidateStage stage,
            String fullName,
            String fatherOrHusbandName,
            HrMaritalStatus maritalStatus,
            HrGender gender,
            LocalDate dateOfBirth,
            String email,
            String mobileNo,
            String postAppliedFor,
            String workExperienceSummary,
            String educationalQualificationSummary,
            Boolean previousAlsorgExperience,
            String previousAlsorgExperienceDetails,
            Boolean familyMemberWorkedAtAlsorg,
            String familyMemberWorkedAtAlsorgDetails,
            String vaccination,
            String presentAddress,
            String permanentAddress,
            String aadhaarNo,
            String panNo,
            String nationality,
            String religion,
            String drivingLicenseNo,
            String familyContactNo,
            String referenceName,
            BigDecimal salaryDrawn,
            BigDecimal salaryExpected,
            BigDecimal salaryApproved,
            String extracurricularActivities,
            String hobbies,
            String awardsAppreciations,
            String organizationChartNote,
            boolean declarationAccepted,
            LocalDateTime declarationAcceptedAt,
            LocalDate proposedJoiningDate,
            String department,
            String designation,
            String appointedBy,
            String hrOwner,
            LocalDateTime lastSubmittedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            long rowVersion,
            List<FamilyMemberRequest> familyMembers,
            List<EducationRequest> educations,
            List<EmploymentRequest> employments,
            List<LanguageRequest> languages
    ) {
    }

    public record PublicCandidateApplicationResponse(
            UUID candidateId,
            String candidateNumber,
            HrCandidateStage stage,
            CandidateDetailResponse application
    ) {
    }
}
