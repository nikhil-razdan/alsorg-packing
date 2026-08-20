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
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Locale;
import java.util.UUID;

@Service
public class HrCandidateService {

    private static final EnumSet<HrCandidateStage> PUBLIC_EDITABLE_STAGES = EnumSet.of(
            HrCandidateStage.NEW,
            HrCandidateStage.APPLICATION_SENT,
            HrCandidateStage.APPLICATION_IN_PROGRESS);

    private static final String HR_FORM_MASTER = "hrflow/HR_Module_Forms_Master.pdf";
    private static final PDFont FORM_FONT = PDType1Font.HELVETICA;
    private static final PDFont FORM_FONT_BOLD = PDType1Font.HELVETICA_BOLD;
    private static final DateTimeFormatter FORM_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final HrCandidateRepository candidateRepository;
    private final HrCandidateTokenService tokenService;
    private final HrAccessService accessService;
    private final HrAuditService auditService;
    private final HrFlowProperties properties;
    private final HrCryptoService cryptoService;
    private final HrDocumentService documentService;
    private final EntityManager entityManager;

    public HrCandidateService(HrCandidateRepository candidateRepository,
            HrCandidateTokenService tokenService,
            HrAccessService accessService,
            HrAuditService auditService,
            HrFlowProperties properties,
            HrCryptoService cryptoService,
            HrDocumentService documentService,
            EntityManager entityManager) {
        this.candidateRepository = candidateRepository;
        this.tokenService = tokenService;
        this.accessService = accessService;
        this.auditService = auditService;
        this.properties = properties;
        this.cryptoService = cryptoService;
        this.documentService = documentService;
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

    // -------------------------------------------------------------------------
    // Official HR form PDF downloads
    // -------------------------------------------------------------------------

    /**
     * Downloads an untouched sample/format from the exact HR master PDF bundled in
     * src/main/resources/hrflow/HR_Module_Forms_Master.pdf.
     */
    @Transactional(readOnly = true)
    public FormPdf formTemplate(String formKey) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER,
                HrAccessRole.HOD
        );
        String key = normalizeFormKey(formKey);
        int[] pages = templatePages(key);
        return new FormPdf(templateFileName(key), extractMasterPages(pages));
    }

    @Transactional(readOnly = true)
    public FormPdf candidateFormPdf(UUID candidateId, String formKey) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER,
                HrAccessRole.HOD
        );
        return candidateFormPdfSystem(candidateId, formKey);
    }

    @Transactional(readOnly = true)
    public FormPdf publicCandidateFormPdf(String rawToken, String formKey) {
        HrCandidate candidate = tokenService.resolveApplicationToken(rawToken);
        return buildCandidateFormPdf(candidate, formKey);
    }

    /** Trusted HRFLOW-to-HRFLOW call used by Employee Master downloads. */
    @Transactional(readOnly = true)
    public FormPdf candidateFormPdfSystem(UUID candidateId, String formKey) {
        return buildCandidateFormPdf(find(candidateId), formKey);
    }

    private FormPdf buildCandidateFormPdf(HrCandidate candidate, String formKey) {
        String key = normalizeFormKey(formKey);
        if (!List.of("PERSONAL_DATA", "EMPLOYMENT_APPLICATION", "CANDIDATE_PACK").contains(key)) {
            throw HrFlowException.badRequest(
                    "Candidate filled PDF supports PERSONAL_DATA, EMPLOYMENT_APPLICATION or CANDIDATE_PACK."
            );
        }

        try (PDDocument master = loadMasterPdf(); PDDocument output = new PDDocument()) {
            Optional<HrDocumentService.DownloadedDocument> photo =
                    documentService.latestActiveSystem(candidate.getId(), HrDocumentType.PHOTO);

            if (key.equals("PERSONAL_DATA") || key.equals("CANDIDATE_PACK")) {
                PDPage page = output.importPage(master.getPage(0));
                overlayPersonalData(output, page, candidate, photo.orElse(null));
            }
            if (key.equals("EMPLOYMENT_APPLICATION") || key.equals("CANDIDATE_PACK")) {
                PDPage page3 = output.importPage(master.getPage(2));
                overlayEmploymentApplicationPage1(output, page3, candidate, photo.orElse(null));
                PDPage page4 = output.importPage(master.getPage(3));
                overlayEmploymentApplicationPage2(output, page4, candidate);
                PDPage page5 = output.importPage(master.getPage(4));
                overlayEmploymentApplicationPage3(output, page5, candidate);
            }

            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            output.save(bytes);
            String prefix = safeFilePart(firstNonBlank(candidate.getCandidateNumber(), candidate.getFullName(), "candidate"));
            return new FormPdf(prefix + "_" + key + ".pdf", bytes.toByteArray());
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not generate the candidate form PDF.", ex);
        }
    }

    private void overlayPersonalData(
            PDDocument document,
            PDPage page,
            HrCandidate c,
            HrDocumentService.DownloadedDocument photo
    ) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            textTop(cs, page, 252, 126, c.getFullName(), 8.0f, false);
            textTop(cs, page, 252, 149, c.getFatherOrHusbandName(), 8.0f, false);
            textTop(cs, page, 252, 172, enumText(c.getMaritalStatus()), 8.0f, false);
            textTop(cs, page, 252, 195, enumText(c.getGender()), 8.0f, false);
            textTop(cs, page, 252, 218, ageAndDob(c.getDateOfBirth()), 8.0f, false);
            wrappedTop(cs, page, 252, 242, c.getWorkExperienceSummary(), 300, 7.2f, 8.4f, 2);
            wrappedTop(cs, page, 252, 266, c.getEducationalQualificationSummary(), 300, 7.2f, 8.4f, 2);

            List<HrEmployment> employments = c.getEmployments();
            HrEmployment first = employments == null || employments.isEmpty() ? null : employments.get(0);
            HrEmployment second = employments == null || employments.size() < 2 ? null : employments.get(1);
            textTop(cs, page, 252, 307, first == null ? null : first.getCompanyName(), 7.5f, false);
            textTop(cs, page, 252, 329, employerHr(first), 7.4f, false);
            textTop(cs, page, 252, 352, second == null ? null : second.getCompanyName(), 7.5f, false);
            textTop(cs, page, 252, 374, employerHr(second), 7.4f, false);

            wrappedTop(cs, page, 252, 404, yesNoDetails(c.getPreviousAlsorgExperience(), c.getPreviousAlsorgExperienceDetails()), 300, 7.0f, 8.2f, 2);
            wrappedTop(cs, page, 252, 443, yesNoDetails(c.getFamilyMemberWorkedAtAlsorg(), c.getFamilyMemberWorkedAtAlsorgDetails()), 300, 7.0f, 8.2f, 2);
            textTop(cs, page, 252, 472, c.getPostAppliedFor(), 7.6f, false);
            textTop(cs, page, 252, 495, c.getVaccination(), 7.3f, false);
            wrappedTop(cs, page, 252, 520, c.getPresentAddress(), 300, 7.0f, 8.0f, 2);
            wrappedTop(cs, page, 252, 550, c.getPermanentAddress(), 300, 7.0f, 8.0f, 2);
            textTop(cs, page, 252, 574, cryptoService.decryptNullable(c.getAadhaarNo()), 7.5f, false);
            textTop(cs, page, 252, 597, c.getMobileNo(), 7.6f, false);
            wrappedTop(cs, page, 252, 620, familySummary(c.getFamilyMembers()), 300, 7.0f, 8.0f, 2);
            textTop(cs, page, 252, 644, c.getFamilyContactNo(), 7.5f, false);
            textTop(cs, page, 252, 666, c.getReferenceName(), 7.5f, false);
            textTop(cs, page, 252, 686, moneyText(c.getSalaryDrawn()), 7.4f, false);
            textTop(cs, page, 455, 686, moneyText(c.getSalaryExpected()), 7.4f, false);
            if (c.isDeclarationAccepted()) {
                textTop(cs, page, 405, 728, safe(c.getFullName()) + " / e-accepted", 6.7f, false);
            }
        }
        drawPhoto(document, page, photo, 405, 104, 130, 96);
    }

    private void overlayEmploymentApplicationPage1(
            PDDocument document,
            PDPage page,
            HrCandidate c,
            HrDocumentService.DownloadedDocument photo
    ) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            textTop(cs, page, 202, 153, c.getPostAppliedFor(), 8.1f, true);
            textTop(cs, page, 345, 217, upper(c.getFullName()), 7.8f, false);
            textTop(cs, page, 260, 236, ageAndDob(c.getDateOfBirth()), 7.4f, false);
            textTop(cs, page, 250, 255, c.getFatherOrHusbandName(), 7.4f, false);
            textTop(cs, page, 200, 275, enumText(c.getGender()), 7.2f, false);
            textTop(cs, page, 480, 275, enumText(c.getMaritalStatus()), 7.2f, false);
            wrappedTop(cs, page, 300, 295, c.getPresentAddress(), 272, 6.6f, 7.6f, 2);
            wrappedTop(cs, page, 455, 315, c.getPermanentAddress(), 125, 5.9f, 6.8f, 2);
            textTop(cs, page, 270, 335, cryptoService.decryptNullable(c.getAadhaarNo()), 6.9f, false);
            textTop(cs, page, 470, 335, cryptoService.decryptNullable(c.getPanNo()), 6.9f, false);
            textTop(cs, page, 245, 355, c.getNationality(), 6.9f, false);
            textTop(cs, page, 445, 355, c.getReligion(), 6.9f, false);
            textTop(cs, page, 285, 375, cryptoService.decryptNullable(c.getDrivingLicenseNo()), 6.8f, false);
            textTop(cs, page, 280, 395, c.getMobileNo(), 7.2f, false);

            float[] familyY = {466, 485, 504, 523, 542};
            List<HrFamilyMember> family = c.getFamilyMembers();
            for (int i = 0; family != null && i < Math.min(family.size(), familyY.length); i++) {
                HrFamilyMember f = family.get(i);
                textTop(cs, page, 113, familyY[i], f.getName(), 6.6f, false);
                textTop(cs, page, 260, familyY[i], f.getRelation(), 6.6f, false);
                textTop(cs, page, 388, familyY[i], dateText(f.getDateOfBirth()), 6.6f, false);
                textTop(cs, page, 515, familyY[i], Boolean.TRUE.equals(f.getDependent()) ? "Y" : "N", 7.0f, false);
            }

            float[] eduY = {669, 688, 707, 726};
            List<HrEducation> educations = c.getEducations();
            for (int i = 0; educations != null && i < Math.min(educations.size(), eduY.length); i++) {
                HrEducation e = educations.get(i);
                textTop(cs, page, 111, eduY[i], e.getExamination(), 6.5f, false);
                textTop(cs, page, 259, eduY[i], e.getBoardOrUniversity(), 6.5f, false);
                textTop(cs, page, 388, eduY[i], e.getYear() == null ? null : String.valueOf(e.getYear()), 6.5f, false);
                textTop(cs, page, 515, eduY[i], moneyText(e.getMarksPercent()), 6.5f, false);
            }
        }
        drawPhoto(document, page, photo, 485, 33, 91, 101);
    }

    private void overlayEmploymentApplicationPage2(PDDocument document, PDPage page, HrCandidate c) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            List<HrEmployment> employments = c.getEmployments();
            HrEmployment first = employments == null || employments.isEmpty() ? null : employments.get(0);
            HrEmployment second = employments == null || employments.size() < 2 ? null : employments.get(1);
            textTop(cs, page, 308, 88, first == null ? null : first.getCompanyName(), 7.4f, false);
            textTop(cs, page, 308, 115, employerHr(first), 7.2f, false);
            textTop(cs, page, 308, 142, second == null ? null : second.getCompanyName(), 7.4f, false);
            textTop(cs, page, 308, 169, employerHr(second), 7.2f, false);
            textTop(cs, page, 118, 247, yesNoDetails(c.getPreviousAlsorgExperience(), c.getPreviousAlsorgExperienceDetails()), 6.7f, false);

            float[] languageY = {292, 319, 346};
            List<HrLanguage> languages = c.getLanguages();
            for (int i = 0; languages != null && i < Math.min(languages.size(), languageY.length); i++) {
                HrLanguage language = languages.get(i);
                textTop(cs, page, 111, languageY[i], language.getLanguage(), 7.0f, false);
                if (Boolean.TRUE.equals(language.getCanRead())) textTop(cs, page, 309, languageY[i], "X", 8.5f, true);
                if (Boolean.TRUE.equals(language.getCanWrite())) textTop(cs, page, 411, languageY[i], "X", 8.5f, true);
                if (Boolean.TRUE.equals(language.getCanSpeak())) textTop(cs, page, 513, languageY[i], "X", 8.5f, true);
            }

            wrappedTop(cs, page, 104, 393, c.getExtracurricularActivities(), 480, 7.0f, 8.3f, 2);
            wrappedTop(cs, page, 104, 448, c.getHobbies(), 480, 7.0f, 8.3f, 2);
            wrappedTop(cs, page, 104, 503, c.getAwardsAppreciations(), 480, 6.8f, 8.1f, 2);
            textTop(cs, page, 197, 535, moneyText(c.getSalaryDrawn()), 7.2f, false);
            textTop(cs, page, 479, 535, moneyText(c.getSalaryExpected()), 7.2f, false);
            textTop(cs, page, 213, 563, moneyText(c.getSalaryApproved()), 7.2f, false);
            wrappedTop(cs, page, 96, 690, c.getOrganizationChartNote(), 475, 6.8f, 8.0f, 4);
        }
    }

    private void overlayEmploymentApplicationPage3(PDDocument document, PDPage page, HrCandidate c) throws IOException {
        try (PDPageContentStream cs = append(document, page)) {
            String acceptedDate = c.getDeclarationAcceptedAt() == null ? null : dateTimeDate(c.getDeclarationAcceptedAt());
            if (c.isDeclarationAccepted()) {
                textTop(cs, page, 112, 175, acceptedDate, 7.0f, false);
                textTop(cs, page, 405, 175, safe(c.getFullName()) + " / e-accepted", 6.8f, false);
            }
            textTop(cs, page, 273, 260, dateTimeDate(c.getUpdatedAt()), 7.2f, false);
            textTop(cs, page, 273, 289, dateText(c.getProposedJoiningDate()), 7.2f, false);
            textTop(cs, page, 273, 314, c.getDepartment(), 7.2f, false);
            textTop(cs, page, 273, 340, firstNonBlank(c.getDesignation(), c.getPostAppliedFor()), 7.2f, false);
            textTop(cs, page, 273, 367, c.getAppointedBy(), 7.2f, false);
        }
    }

    private PDPageContentStream append(PDDocument document, PDPage page) throws IOException {
        return new PDPageContentStream(document, page, AppendMode.APPEND, true, true);
    }

    private void drawPhoto(
            PDDocument document,
            PDPage page,
            HrDocumentService.DownloadedDocument photo,
            float x,
            float top,
            float boxWidth,
            float boxHeight
    ) {
        if (photo == null || photo.bytes() == null || photo.bytes().length == 0) return;
        String contentType = safe(photo.contentType()).toLowerCase(Locale.ROOT);
        if (!contentType.startsWith("image/")) return;
        try {
            PDImageXObject image = PDImageXObject.createFromByteArray(document, photo.bytes(), photo.fileName());
            float scale = Math.min(boxWidth / image.getWidth(), boxHeight / image.getHeight());
            float width = image.getWidth() * scale;
            float height = image.getHeight() * scale;
            float y = page.getMediaBox().getHeight() - top - height;
            float drawX = x + (boxWidth - width) / 2f;
            float drawY = y + (boxHeight - height) / 2f;
            try (PDPageContentStream cs = append(document, page)) {
                cs.drawImage(image, drawX, drawY, width, height);
            }
        } catch (Exception ignored) {
            // A corrupt or unsupported photo must not prevent the official form PDF.
        }
    }

    private void textTop(
            PDPageContentStream cs,
            PDPage page,
            float x,
            float top,
            String value,
            float fontSize,
            boolean bold
    ) throws IOException {
        String text = pdfSafe(value);
        if (text == null) return;
        cs.beginText();
        cs.setFont(bold ? FORM_FONT_BOLD : FORM_FONT, fontSize);
        cs.newLineAtOffset(x, page.getMediaBox().getHeight() - top - fontSize);
        cs.showText(text);
        cs.endText();
    }

    private void wrappedTop(
            PDPageContentStream cs,
            PDPage page,
            float x,
            float top,
            String value,
            float maxWidth,
            float fontSize,
            float leading,
            int maxLines
    ) throws IOException {
        String text = pdfSafe(value);
        if (text == null) return;
        List<String> lines = wrap(text, FORM_FONT, fontSize, maxWidth, maxLines);
        for (int i = 0; i < lines.size(); i++) {
            textTop(cs, page, x, top + (i * leading), lines.get(i), fontSize, false);
        }
    }

    private List<String> wrap(String text, PDFont font, float fontSize, float maxWidth, int maxLines) throws IOException {
        java.util.ArrayList<String> result = new java.util.ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split("\\s+")) {
            String candidate = line.length() == 0 ? word : line + " " + word;
            float width = font.getStringWidth(candidate) / 1000f * fontSize;
            if (width <= maxWidth || line.length() == 0) {
                line.setLength(0);
                line.append(candidate);
            } else {
                result.add(line.toString());
                line.setLength(0);
                line.append(word);
                if (result.size() >= maxLines - 1) break;
            }
        }
        if (line.length() > 0 && result.size() < maxLines) result.add(line.toString());
        return result;
    }

    private byte[] extractMasterPages(int... pageIndexes) {
        try (PDDocument master = loadMasterPdf(); PDDocument output = new PDDocument()) {
            for (int pageIndex : pageIndexes) {
                if (pageIndex < 0 || pageIndex >= master.getNumberOfPages()) {
                    throw HrFlowException.badRequest("Invalid HR master form page index: " + pageIndex);
                }
                output.importPage(master.getPage(pageIndex));
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            output.save(bytes);
            return bytes.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not read the HR master form PDF.", ex);
        }
    }

    private PDDocument loadMasterPdf() throws IOException {
        ClassPathResource resource = new ClassPathResource(HR_FORM_MASTER);

        if (!resource.exists()) {
            throw new IllegalStateException(
                    "Missing HRFLOW PDF resource on the runtime classpath: " + HR_FORM_MASTER
            );
        }

        /*
         * IMPORTANT:
         * Do not return PDDocument.load(InputStream) from inside a try-with-resources
         * block. PDFBox may continue reading from its source after PDDocument.load(...)
         * returns. Closing the ClassPathResource InputStream before the PDDocument is
         * actually used causes every page-extract / overlay download to fail with HTTP
         * 500 at runtime.
         *
         * Read the complete resource first and load PDFBox from the independent byte[].
         */
        byte[] pdfBytes;
        try (InputStream in = resource.getInputStream()) {
            pdfBytes = in.readAllBytes();
        }

        if (pdfBytes.length < 5
                || pdfBytes[0] != '%'
                || pdfBytes[1] != 'P'
                || pdfBytes[2] != 'D'
                || pdfBytes[3] != 'F'
                || pdfBytes[4] != '-') {
            throw new IllegalStateException(
                    "HRFLOW master form resource is not a valid PDF: " + HR_FORM_MASTER
            );
        }

        PDDocument document = PDDocument.load(pdfBytes);

        if (document.getNumberOfPages() < 12) {
            int pages = document.getNumberOfPages();
            document.close();
            throw new IllegalStateException(
                    "HRFLOW master form PDF must contain 12 pages, but runtime resource contains "
                            + pages + " page(s)."
            );
        }

        return document;
    }

    private int[] templatePages(String key) {
        return switch (key) {
            case "PERSONAL_DATA" -> new int[]{0};
            case "JOINING_REPORT" -> new int[]{1};
            case "EMPLOYMENT_APPLICATION" -> new int[]{2, 3, 4};
            case "HOLIDAY_LEAVE" -> new int[]{5};
            case "ORIENTATION" -> new int[]{6};
            case "INDUCTION_FEEDBACK" -> new int[]{7};
            case "NDA" -> new int[]{8, 9, 10};
            case "DECLARATION" -> new int[]{11};
            case "CANDIDATE_PACK" -> new int[]{0, 2, 3, 4};
            case "ONBOARDING_PACK" -> new int[]{1, 5, 6, 7, 8, 9, 10, 11};
            case "FULL_PACK", "FULL_HR_PACK" -> new int[]{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11};
            default -> throw HrFlowException.badRequest(
                    "Unknown HR form key. Use PERSONAL_DATA, JOINING_REPORT, EMPLOYMENT_APPLICATION, " +
                            "HOLIDAY_LEAVE, ORIENTATION, INDUCTION_FEEDBACK, NDA, DECLARATION, " +
                            "CANDIDATE_PACK, ONBOARDING_PACK or FULL_PACK."
            );
        };
    }

    private String templateFileName(String key) {
        return switch (key) {
            case "PERSONAL_DATA" -> "HR_Personal_Data_Form_Blank.pdf";
            case "JOINING_REPORT" -> "HR_Joining_Report_Blank.pdf";
            case "EMPLOYMENT_APPLICATION" -> "HR_Employment_Application_Form_Blank.pdf";
            case "HOLIDAY_LEAVE" -> "HR_Holiday_Leave_2026_Blank.pdf";
            case "ORIENTATION" -> "HR_New_Employee_Orientation_Checklist_Blank.pdf";
            case "INDUCTION_FEEDBACK" -> "HR_Induction_Feedback_Blank.pdf";
            case "NDA" -> "HR_Mutual_NDA_Blank.pdf";
            case "DECLARATION" -> "HR_Employment_Declaration_Blank.pdf";
            case "CANDIDATE_PACK" -> "HR_Candidate_Forms_Blank.pdf";
            case "ONBOARDING_PACK" -> "HR_Onboarding_Forms_Blank.pdf";
            default -> "HR_Module_Forms_Full_Blank.pdf";
        };
    }

    private String normalizeFormKey(String value) {
        String key = safe(value).trim().toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        if (key.isBlank()) throw HrFlowException.badRequest("Form key is required.");
        return switch (key) {
            case "PERSONAL", "PERSONAL_DATA_FORM" -> "PERSONAL_DATA";
            case "APPLICATION", "EMPLOYMENT", "EMPLOYMENT_APPLICATION_FORM" -> "EMPLOYMENT_APPLICATION";
            case "JOINING", "JOINING_FORM" -> "JOINING_REPORT";
            case "HOLIDAY", "LEAVE", "POLICY", "HOLIDAY_LEAVE_2026" -> "HOLIDAY_LEAVE";
            case "ORIENTATION_CHECKLIST", "ORIENTATION_FORM" -> "ORIENTATION";
            case "FEEDBACK", "INDUCTION", "INDUCTION_BACK" -> "INDUCTION_FEEDBACK";
            case "MUTUAL_NDA", "NON_DISCLOSURE_AGREEMENT" -> "NDA";
            case "EMPLOYMENT_DECLARATION" -> "DECLARATION";
            case "ALL", "MASTER", "FULL" -> "FULL_PACK";
            default -> key;
        };
    }

    private String pdfSafe(String value) {
        String v = clean(value);
        if (v == null) return null;
        v = v.replace('\u2018', '\'').replace('\u2019', '\'')
                .replace('\u201c', '"').replace('\u201d', '"')
                .replace('\u2013', '-').replace('\u2014', '-')
                .replace('\u00a0', ' ');
        StringBuilder out = new StringBuilder(v.length());
        for (char ch : v.toCharArray()) {
            out.append(ch >= 32 && ch <= 126 ? ch : '?');
        }
        return out.toString();
    }

    private String dateText(LocalDate value) {
        return value == null ? null : FORM_DATE.format(value);
    }

    private String dateTimeDate(LocalDateTime value) {
        return value == null ? null : FORM_DATE.format(value.toLocalDate());
    }

    private String ageAndDob(LocalDate dob) {
        if (dob == null) return null;
        int years = Math.max(0, Period.between(dob, LocalDate.now()).getYears());
        return years + " / " + dateText(dob);
    }

    private String enumText(Object value) {
        return value == null ? null : String.valueOf(value).replace('_', ' ');
    }

    private String yesNoDetails(Boolean value, String details) {
        if (value == null) return details;
        String prefix = value ? "Yes" : "No";
        return clean(details) == null ? prefix : prefix + " - " + clean(details);
    }

    private String employerHr(HrEmployment employment) {
        if (employment == null) return null;
        String name = clean(employment.getHrName());
        String contact = clean(employment.getHrContact());
        if (name == null) return contact;
        if (contact == null) return name;
        return name + " / " + contact;
    }

    private String familySummary(List<HrFamilyMember> family) {
        if (family == null || family.isEmpty()) return null;
        return family.stream()
                .limit(4)
                .map(f -> firstNonBlank(f.getName(), "-") + (clean(f.getRelation()) == null ? "" : " (" + f.getRelation() + ")"))
                .reduce((a, b) -> a + ", " + b)
                .orElse(null);
    }

    private String moneyText(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros().toPlainString();
    }

    private String upper(String value) {
        String v = clean(value);
        return v == null ? null : v.toUpperCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String safeFilePart(String value) {
        String v = safe(value).trim().replaceAll("[^A-Za-z0-9._-]+", "_");
        return v.isBlank() ? "HR_Form" : v;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            String v = clean(value);
            if (v != null) return v;
        }
        return null;
    }

    public record FormPdf(String fileName, byte[] bytes) {}

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
