package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class HrCandidateDtos {

    private HrCandidateDtos() {
    }

    public record FamilyMemberRequest(
            String name,
            String relation,
            LocalDate dateOfBirth,
            Boolean dependent
    ) {}

    public record EducationRequest(
            String examination,
            String boardOrUniversity,
            Integer year,
            BigDecimal marksPercent
    ) {}

    public record EmploymentRequest(
            String companyName,
            String designation,
            LocalDate fromDate,
            LocalDate toDate,
            String hrName,
            String hrContact,
            BigDecimal lastSalary,
            String reasonForLeaving
    ) {}

    public record LanguageRequest(
            String language,
            Boolean canRead,
            Boolean canWrite,
            Boolean canSpeak
    ) {}

    public record CreateCandidateRequest(
            @NotNull HrApplicationType applicationType,
            String fullName,
            @Email String email,
            String mobileNo,
            String postAppliedFor,
            String department,
            String designation,
            String hrOwner
    ) {}

    public record CandidateApplicationRequest(
            Long rowVersion,
            HrApplicationType applicationType,
            String fullName,
            String fatherOrHusbandName,
            HrMaritalStatus maritalStatus,
            HrGender gender,
            LocalDate dateOfBirth,
            @Email String email,
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
            String extracurricularActivities,
            String hobbies,
            String awardsAppreciations,
            String organizationChartNote,
            Boolean declarationAccepted,
            @Valid List<FamilyMemberRequest> familyMembers,
            @Valid List<EducationRequest> educations,
            @Valid List<EmploymentRequest> employments,
            @Valid List<LanguageRequest> languages
    ) {}

    public record HrCandidateUpdateRequest(
            Long rowVersion,
            String fullName,
            @Email String email,
            String mobileNo,
            String postAppliedFor,
            BigDecimal salaryApproved,
            LocalDate proposedJoiningDate,
            String department,
            String designation,
            String appointedBy,
            String hrOwner
    ) {}

    public record ChangeStageRequest(
            @NotNull HrCandidateStage stage,
            String remarks
    ) {}

    public record ApplicationLinkResponse(
            UUID candidateId,
            String candidateNumber,
            String token,
            LocalDateTime expiresAt
    ) {}

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
    ) {}

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
    ) {}

    public record PublicCandidateApplicationResponse(
            UUID candidateId,
            String candidateNumber,
            HrCandidateStage stage,
            CandidateDetailResponse application
    ) {}
}
