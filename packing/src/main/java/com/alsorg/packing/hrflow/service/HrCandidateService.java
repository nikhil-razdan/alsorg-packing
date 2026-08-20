package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.config.HrFlowProperties;
import com.alsorg.packing.hrflow.domain.*;
import com.alsorg.packing.hrflow.domain.value.HrEducation;
import com.alsorg.packing.hrflow.domain.value.HrEmployment;
import com.alsorg.packing.hrflow.domain.value.HrFamilyMember;
import com.alsorg.packing.hrflow.domain.value.HrLanguage;
import com.alsorg.packing.hrflow.dto.HrCandidateDtos;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrCandidateRepository;
import com.alsorg.packing.hrflow.security.HrAccessService;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.Locale;
import java.util.UUID;

@Service
public class HrCandidateService {

    private static final EnumSet<HrCandidateStage> PUBLIC_EDITABLE_STAGES = EnumSet.of(
            HrCandidateStage.NEW,
            HrCandidateStage.APPLICATION_SENT,
            HrCandidateStage.APPLICATION_IN_PROGRESS);

    private final HrCandidateRepository candidateRepository;
    private final HrCandidateTokenService tokenService;
    private final HrAccessService accessService;
    private final HrAuditService auditService;
    private final HrFlowProperties properties;
    private final HrCryptoService cryptoService;
    private final EntityManager entityManager;

    public HrCandidateService(HrCandidateRepository candidateRepository,
            HrCandidateTokenService tokenService,
            HrAccessService accessService,
            HrAuditService auditService,
            HrFlowProperties properties,
            HrCryptoService cryptoService,
            EntityManager entityManager) {
        this.candidateRepository = candidateRepository;
        this.tokenService = tokenService;
        this.accessService = accessService;
        this.auditService = auditService;
        this.properties = properties;
        this.cryptoService = cryptoService;
        this.entityManager = entityManager;
    }

    @Transactional
    public HrCandidateDtos.CandidateDetailResponse create(HrCandidateDtos.CreateCandidateRequest request) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER);
        String actor = accessService.actor();

        HrCandidate candidate = new HrCandidate();
        candidate.setCandidateNumber(generateCandidateNumber());
        candidate.setApplicationType(request.applicationType());
        candidate.setFullName(clean(request.fullName()));
        candidate.setEmail(cleanLower(request.email()));
        candidate.setMobileNo(clean(request.mobileNo()));
        candidate.setPostAppliedFor(clean(request.postAppliedFor()));
        candidate.setDepartment(clean(request.department()));
        candidate.setDesignation(clean(request.designation()));
        candidate.setHrOwner(clean(request.hrOwner()));
        candidate.setStage(HrCandidateStage.NEW);
        candidate.setCreatedBy(actor);
        candidate.setUpdatedBy(actor);

        candidate = candidateRepository.save(candidate);
        auditService.log(HrAuditAction.CANDIDATE_CREATED, "CANDIDATE", candidate.getId().toString(), actor,
                "Candidate created: " + candidate.getCandidateNumber(), null);
        return toDetail(candidate, true);
    }

    @Transactional(readOnly = true)
    public Page<HrCandidateDtos.CandidateSummaryResponse> list(String q, HrCandidateStage stage, Pageable pageable) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER, HrAccessRole.HOD);
        return candidateRepository.search(clean(q), stage, pageable).map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public HrCandidateDtos.CandidateDetailResponse get(UUID id) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER, HrAccessRole.HOD);
        return toDetail(find(id), true);
    }

    @Transactional
    public HrCandidateDtos.CandidateDetailResponse updateInternal(UUID id,
            HrCandidateDtos.HrCandidateUpdateRequest request) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE);
        String actor = accessService.actor();
        HrCandidate c = find(id);
        assertRowVersion(c, request.rowVersion());

        if (request.fullName() != null)
            c.setFullName(clean(request.fullName()));
        if (request.email() != null)
            c.setEmail(cleanLower(request.email()));
        if (request.mobileNo() != null)
            c.setMobileNo(clean(request.mobileNo()));
        if (request.postAppliedFor() != null)
            c.setPostAppliedFor(clean(request.postAppliedFor()));
        if (request.salaryApproved() != null)
            c.setSalaryApproved(request.salaryApproved());
        if (request.proposedJoiningDate() != null)
            c.setProposedJoiningDate(request.proposedJoiningDate());
        if (request.department() != null)
            c.setDepartment(clean(request.department()));
        if (request.designation() != null)
            c.setDesignation(clean(request.designation()));
        if (request.appointedBy() != null)
            c.setAppointedBy(clean(request.appointedBy()));
        if (request.hrOwner() != null)
            c.setHrOwner(clean(request.hrOwner()));
        c.setUpdatedBy(actor);

        auditService.log(HrAuditAction.CANDIDATE_UPDATED, "CANDIDATE", c.getId().toString(), actor,
                "Candidate HR details updated.", null);
        return toDetail(c, true);
    }

    @Transactional
    public HrCandidateDtos.ApplicationLinkResponse createApplicationLink(UUID id) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER);
        String actor = accessService.actor();
        HrCandidate c = find(id);
        if (EnumSet.of(HrCandidateStage.REJECTED, HrCandidateStage.WITHDRAWN, HrCandidateStage.JOINED)
                .contains(c.getStage())) {
            throw HrFlowException
                    .conflict("An application link cannot be created for a candidate in stage " + c.getStage() + ".");
        }
        HrCandidateTokenService.IssuedToken issued = tokenService.issueApplicationToken(c, actor);
        if (c.getStage() == HrCandidateStage.NEW)
            c.setStage(HrCandidateStage.APPLICATION_SENT);
        c.setUpdatedBy(actor);
        auditService.log(HrAuditAction.APPLICATION_LINK_CREATED, "CANDIDATE", c.getId().toString(), actor,
                "Candidate application link created.", null);
        return new HrCandidateDtos.ApplicationLinkResponse(c.getId(), c.getCandidateNumber(), issued.rawToken(),
                issued.expiresAt());
    }

    @Transactional
    public HrCandidateDtos.CandidateDetailResponse changeStage(UUID id, HrCandidateDtos.ChangeStageRequest request) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER);
        String actor = accessService.actor();
        HrCandidate c = find(id);
        HrCandidateStage from = c.getStage();
        HrCandidateStage to = request.stage();
        validateStageChange(from, to);
        c.setStage(to);
        c.setUpdatedBy(actor);
        auditService.log(HrAuditAction.CANDIDATE_STAGE_CHANGED, "CANDIDATE", c.getId().toString(), actor,
                "Candidate stage changed from " + from + " to " + to
                        + (isBlank(request.remarks()) ? "." : ". Remarks: " + request.remarks()),
                null);
        return toDetail(c, true);
    }

    /**
     * Permanently deletes a recruitment candidate and candidate-owned pre-joining
     * data. This operation is intentionally restricted to a FlowSuite global ADMIN.
     *
     * Joined candidates / employee masters are protected: deleting them through the
     * recruitment screen would silently become an employee deletion and could break
     * employment records. Such records must be handled by an employee-specific
     * lifecycle operation instead.
     */
    @Transactional
    public void deleteCandidate(UUID id, Long requestRowVersion) {
        accessService.requireGlobalAdmin();

        HrCandidate candidate = find(id);

        if (requestRowVersion == null) {
            throw HrFlowException.badRequest("Candidate rowVersion is required for deletion.");
        }
        assertRowVersion(candidate, requestRowVersion);

        Number employeeCount = (Number) entityManager.createNativeQuery(
                        "select count(*) from hr_employee where candidate_id = :candidateId")
                .setParameter("candidateId", id)
                .getSingleResult();

        Number joiningReportCount = (Number) entityManager.createNativeQuery(
                        "select count(*) from hr_joining_report where candidate_id = :candidateId")
                .setParameter("candidateId", id)
                .getSingleResult();

        if (candidate.getStage() == HrCandidateStage.JOINED
                || employeeCount.longValue() > 0
                || joiningReportCount.longValue() > 0) {
            throw HrFlowException.conflict(
                    "This candidate has already been converted to an employee and cannot be deleted from Recruitment.");
        }

        String actor = accessService.actor();
        String candidateNumber = candidate.getCandidateNumber();
        HrCandidateStage candidateStage = candidate.getStage();

        // Batch-2 relations do not use ON DELETE CASCADE, so remove the
        // candidate-owned pre-joining rows first. A pre-joining onboarding case
        // is safe to remove because the employee guard above guarantees that no
        // employee or joining report exists.
        entityManager.createNativeQuery(
                        "delete from hr_onboarding_case where candidate_id = :candidateId")
                .setParameter("candidateId", id)
                .executeUpdate();

        entityManager.createNativeQuery(
                        "delete from hr_candidate_document where candidate_id = :candidateId")
                .setParameter("candidateId", id)
                .executeUpdate();

        // Tokens and the candidate's element-collection tables are already
        // ON DELETE CASCADE in the recruitment foundation migration.
        auditService.log(
                HrAuditAction.CANDIDATE_DELETED,
                "CANDIDATE",
                id.toString(),
                actor,
                "Candidate permanently deleted by FlowSuite ADMIN: " + candidateNumber,
                "{\"candidateNumber\":\"" + candidateNumber + "\",\"stage\":\"" + candidateStage + "\"}"
        );

        entityManager.remove(candidate);
        entityManager.flush();
    }

    @Transactional
    public HrCandidateDtos.PublicCandidateApplicationResponse getPublicApplication(String rawToken) {
        HrCandidate c = tokenService.resolveApplicationToken(rawToken);
        return new HrCandidateDtos.PublicCandidateApplicationResponse(c.getId(), c.getCandidateNumber(), c.getStage(),
                toDetail(c, false));
    }

    @Transactional
    public HrCandidateDtos.PublicCandidateApplicationResponse savePublicDraft(String rawToken,
            HrCandidateDtos.CandidateApplicationRequest request) {
        HrCandidate c = tokenService.resolveApplicationToken(rawToken);
        requirePublicEditable(c);
        assertRowVersion(c, request.rowVersion());
        applyApplication(c, request);
        if (c.getStage() == HrCandidateStage.NEW || c.getStage() == HrCandidateStage.APPLICATION_SENT) {
            c.setStage(HrCandidateStage.APPLICATION_IN_PROGRESS);
        }
        c.setUpdatedBy("CANDIDATE");
        auditService.log(HrAuditAction.APPLICATION_DRAFT_SAVED, "CANDIDATE", c.getId().toString(), "CANDIDATE",
                "Candidate application draft saved.", null);
        return new HrCandidateDtos.PublicCandidateApplicationResponse(c.getId(), c.getCandidateNumber(), c.getStage(),
                toDetail(c, false));
    }

    @Transactional
    public HrCandidateDtos.PublicCandidateApplicationResponse submitPublicApplication(String rawToken,
            HrCandidateDtos.CandidateApplicationRequest request) {
        HrCandidate c = tokenService.resolveApplicationToken(rawToken);
        requirePublicEditable(c);
        assertRowVersion(c, request.rowVersion());
        applyApplication(c, request);
        validateSubmission(c);
        c.setStage(HrCandidateStage.APPLICATION_SUBMITTED);
        c.setLastSubmittedAt(LocalDateTime.now());
        if (!c.isDeclarationAccepted()) {
            throw HrFlowException.badRequest("The applicant declaration must be accepted before submission.");
        }
        if (c.getDeclarationAcceptedAt() == null)
            c.setDeclarationAcceptedAt(LocalDateTime.now());
        c.setUpdatedBy("CANDIDATE");
        auditService.log(HrAuditAction.APPLICATION_SUBMITTED, "CANDIDATE", c.getId().toString(), "CANDIDATE",
                "Candidate application submitted.", null);
        return new HrCandidateDtos.PublicCandidateApplicationResponse(c.getId(), c.getCandidateNumber(), c.getStage(),
                toDetail(c, false));
    }

    private void applyApplication(HrCandidate c, HrCandidateDtos.CandidateApplicationRequest r) {
        if (r.applicationType() != null)
            c.setApplicationType(r.applicationType());
        if (r.fullName() != null)
            c.setFullName(clean(r.fullName()));
        if (r.fatherOrHusbandName() != null)
            c.setFatherOrHusbandName(clean(r.fatherOrHusbandName()));
        if (r.maritalStatus() != null)
            c.setMaritalStatus(r.maritalStatus());
        if (r.gender() != null)
            c.setGender(r.gender());
        if (r.dateOfBirth() != null)
            c.setDateOfBirth(r.dateOfBirth());
        if (r.email() != null)
            c.setEmail(cleanLower(r.email()));
        if (r.mobileNo() != null)
            c.setMobileNo(clean(r.mobileNo()));
        if (r.postAppliedFor() != null)
            c.setPostAppliedFor(clean(r.postAppliedFor()));
        if (r.workExperienceSummary() != null)
            c.setWorkExperienceSummary(clean(r.workExperienceSummary()));
        if (r.educationalQualificationSummary() != null)
            c.setEducationalQualificationSummary(clean(r.educationalQualificationSummary()));
        if (r.previousAlsorgExperience() != null)
            c.setPreviousAlsorgExperience(r.previousAlsorgExperience());
        if (r.previousAlsorgExperienceDetails() != null)
            c.setPreviousAlsorgExperienceDetails(clean(r.previousAlsorgExperienceDetails()));
        if (r.familyMemberWorkedAtAlsorg() != null)
            c.setFamilyMemberWorkedAtAlsorg(r.familyMemberWorkedAtAlsorg());
        if (r.familyMemberWorkedAtAlsorgDetails() != null)
            c.setFamilyMemberWorkedAtAlsorgDetails(clean(r.familyMemberWorkedAtAlsorgDetails()));
        if (r.vaccination() != null)
            c.setVaccination(clean(r.vaccination()));
        if (r.presentAddress() != null)
            c.setPresentAddress(clean(r.presentAddress()));
        if (r.permanentAddress() != null)
            c.setPermanentAddress(clean(r.permanentAddress()));
        if (r.aadhaarNo() != null)
            c.setAadhaarNo(cryptoService.encryptNullable(cleanId(r.aadhaarNo())));
        if (r.panNo() != null)
            c.setPanNo(cryptoService.encryptNullable(cleanId(r.panNo())));
        if (r.nationality() != null)
            c.setNationality(clean(r.nationality()));
        if (r.religion() != null)
            c.setReligion(clean(r.religion()));
        if (r.drivingLicenseNo() != null)
            c.setDrivingLicenseNo(cryptoService.encryptNullable(cleanId(r.drivingLicenseNo())));
        if (r.familyContactNo() != null)
            c.setFamilyContactNo(clean(r.familyContactNo()));
        if (r.referenceName() != null)
            c.setReferenceName(clean(r.referenceName()));
        if (r.salaryDrawn() != null)
            c.setSalaryDrawn(r.salaryDrawn());
        if (r.salaryExpected() != null)
            c.setSalaryExpected(r.salaryExpected());
        if (r.extracurricularActivities() != null)
            c.setExtracurricularActivities(clean(r.extracurricularActivities()));
        if (r.hobbies() != null)
            c.setHobbies(clean(r.hobbies()));
        if (r.awardsAppreciations() != null)
            c.setAwardsAppreciations(clean(r.awardsAppreciations()));
        if (r.organizationChartNote() != null)
            c.setOrganizationChartNote(clean(r.organizationChartNote()));
        if (r.declarationAccepted() != null) {
            c.setDeclarationAccepted(r.declarationAccepted());
            c.setDeclarationAcceptedAt(r.declarationAccepted() ? LocalDateTime.now() : null);
        }

        if (r.familyMembers() != null) {
            c.setFamilyMembers(r.familyMembers().stream()
                    .map(x -> new HrFamilyMember(clean(x.name()), clean(x.relation()), x.dateOfBirth(), x.dependent()))
                    .toList());
        }
        if (r.educations() != null) {
            c.setEducations(r.educations().stream()
                    .map(x -> new HrEducation(clean(x.examination()), clean(x.boardOrUniversity()), x.year(),
                            x.marksPercent()))
                    .toList());
        }
        if (r.employments() != null) {
            c.setEmployments(r.employments().stream()
                    .map(x -> new HrEmployment(clean(x.companyName()), clean(x.designation()), x.fromDate(), x.toDate(),
                            clean(x.hrName()), clean(x.hrContact()), x.lastSalary(), clean(x.reasonForLeaving())))
                    .toList());
        }
        if (r.languages() != null) {
            c.setLanguages(r.languages().stream()
                    .map(x -> new HrLanguage(clean(x.language()), x.canRead(), x.canWrite(), x.canSpeak()))
                    .toList());
        }
    }

    private void validateSubmission(HrCandidate c) {
        if (isBlank(c.getFullName()))
            throw HrFlowException.badRequest("Name is required.");
        if (c.getDateOfBirth() == null)
            throw HrFlowException.badRequest("Date of birth is required.");
        if (c.getDateOfBirth().isAfter(LocalDate.now()))
            throw HrFlowException.badRequest("Date of birth cannot be in the future.");
        if (isBlank(c.getMobileNo()))
            throw HrFlowException.badRequest("Mobile number is required.");
        if (isBlank(c.getPostAppliedFor()))
            throw HrFlowException.badRequest("Post applied for is required.");
        if (isBlank(c.getPresentAddress()))
            throw HrFlowException.badRequest("Present address is required.");
        if (isBlank(c.getPermanentAddress()))
            throw HrFlowException.badRequest("Permanent address is required.");
        if (!c.isDeclarationAccepted())
            throw HrFlowException.badRequest("Applicant declaration must be accepted.");
    }

    private void validateStageChange(HrCandidateStage from, HrCandidateStage to) {
        if (from == to)
            return;
        if (from == HrCandidateStage.JOINED)
            throw HrFlowException.conflict("A joined candidate cannot be moved back through recruitment stages.");
        if (from == HrCandidateStage.REJECTED && to != HrCandidateStage.HR_REVIEW && to != HrCandidateStage.ON_HOLD) {
            throw HrFlowException.conflict("A rejected candidate can only be reopened to HR_REVIEW or ON_HOLD.");
        }
        if (to == HrCandidateStage.JOINED) {
            throw HrFlowException.conflict(
                    "JOINED will be controlled by the onboarding workflow, not by recruitment stage editing.");
        }
    }

    private void requirePublicEditable(HrCandidate c) {
        if (!PUBLIC_EDITABLE_STAGES.contains(c.getStage())) {
            throw HrFlowException.conflict("This application has already been submitted or is no longer editable.");
        }
    }

    private void assertRowVersion(HrCandidate c, Long requestVersion) {
        if (requestVersion != null && requestVersion.longValue() != c.getRowVersion()) {
            throw HrFlowException.conflict("This candidate record changed after it was opened. Refresh and try again.");
        }
    }

    private HrCandidate find(UUID id) {
        if (id == null) {
            throw HrFlowException.badRequest("Candidate id is required.");
        }

        HrCandidate candidate = entityManager.find(HrCandidate.class, id);
        if (candidate == null) {
            throw HrFlowException.notFound("Candidate not found: " + id);
        }
        return candidate;
    }

    private String generateCandidateNumber() {
        String prefix = clean(properties.getCandidateNumberPrefix());
        if (isBlank(prefix))
            prefix = "CAND";
        String random = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return prefix.toUpperCase(Locale.ROOT) + "-" + LocalDate.now().getYear() + "-" + random;
    }

    private HrCandidateDtos.CandidateSummaryResponse toSummary(HrCandidate c) {
        return new HrCandidateDtos.CandidateSummaryResponse(
                c.getId(), c.getCandidateNumber(), c.getApplicationType(), c.getStage(), c.getFullName(),
                c.getEmail(), c.getMobileNo(), c.getPostAppliedFor(), c.getDepartment(), c.getDesignation(),
                c.getHrOwner(), c.getProposedJoiningDate(), c.getCreatedAt(), c.getLastSubmittedAt(),
                c.getRowVersion());
    }

    public HrCandidateDtos.CandidateDetailResponse toDetail(HrCandidate c, boolean maskSensitive) {
        return new HrCandidateDtos.CandidateDetailResponse(
                c.getId(), c.getCandidateNumber(), c.getApplicationType(), c.getStage(), c.getFullName(),
                c.getFatherOrHusbandName(), c.getMaritalStatus(), c.getGender(), c.getDateOfBirth(), c.getEmail(),
                c.getMobileNo(), c.getPostAppliedFor(), c.getWorkExperienceSummary(),
                c.getEducationalQualificationSummary(),
                c.getPreviousAlsorgExperience(), c.getPreviousAlsorgExperienceDetails(),
                c.getFamilyMemberWorkedAtAlsorg(),
                c.getFamilyMemberWorkedAtAlsorgDetails(), c.getVaccination(), c.getPresentAddress(),
                c.getPermanentAddress(),
                maskSensitive ? mask(cryptoService.decryptNullable(c.getAadhaarNo()), 4)
                        : cryptoService.decryptNullable(c.getAadhaarNo()),
                maskSensitive ? mask(cryptoService.decryptNullable(c.getPanNo()), 4)
                        : cryptoService.decryptNullable(c.getPanNo()),
                c.getNationality(), c.getReligion(),
                maskSensitive ? mask(cryptoService.decryptNullable(c.getDrivingLicenseNo()), 4)
                        : cryptoService.decryptNullable(c.getDrivingLicenseNo()),
                c.getFamilyContactNo(), c.getReferenceName(), c.getSalaryDrawn(), c.getSalaryExpected(),
                c.getSalaryApproved(),
                c.getExtracurricularActivities(), c.getHobbies(), c.getAwardsAppreciations(),
                c.getOrganizationChartNote(),
                c.isDeclarationAccepted(), c.getDeclarationAcceptedAt(), c.getProposedJoiningDate(), c.getDepartment(),
                c.getDesignation(), c.getAppointedBy(), c.getHrOwner(), c.getLastSubmittedAt(), c.getCreatedAt(),
                c.getUpdatedAt(),
                c.getRowVersion(),
                c.getFamilyMembers().stream()
                        .map(x -> new HrCandidateDtos.FamilyMemberRequest(x.getName(), x.getRelation(),
                                x.getDateOfBirth(), x.getDependent()))
                        .toList(),
                c.getEducations().stream()
                        .map(x -> new HrCandidateDtos.EducationRequest(x.getExamination(), x.getBoardOrUniversity(),
                                x.getYear(), x.getMarksPercent()))
                        .toList(),
                c.getEmployments().stream()
                        .map(x -> new HrCandidateDtos.EmploymentRequest(x.getCompanyName(), x.getDesignation(),
                                x.getFromDate(), x.getToDate(), x.getHrName(), x.getHrContact(), x.getLastSalary(),
                                x.getReasonForLeaving()))
                        .toList(),
                c.getLanguages().stream().map(x -> new HrCandidateDtos.LanguageRequest(x.getLanguage(), x.getCanRead(),
                        x.getCanWrite(), x.getCanSpeak())).toList());
    }

    private String mask(String value, int visibleTail) {
        if (isBlank(value))
            return value;
        String v = value.trim();
        if (v.length() <= visibleTail)
            return "*".repeat(v.length());
        return "*".repeat(v.length() - visibleTail) + v.substring(v.length() - visibleTail);
    }

    private String clean(String value) {
        if (value == null)
            return null;
        String v = value.trim();
        return v.isEmpty() ? null : v;
    }

    private String cleanLower(String value) {
        String v = clean(value);
        return v == null ? null : v.toLowerCase(Locale.ROOT);
    }

    private String cleanId(String value) {
        String v = clean(value);
        return v == null ? null : v.toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
