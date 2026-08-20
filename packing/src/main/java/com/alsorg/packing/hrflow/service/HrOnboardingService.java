package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.config.HrFlowProperties;
import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.domain.HrApplicationType;
import com.alsorg.packing.hrflow.domain.HrAuditAction;
import com.alsorg.packing.hrflow.domain.HrCandidate;
import com.alsorg.packing.hrflow.domain.HrCandidateStage;
import com.alsorg.packing.hrflow.domain.HrDocumentType;
import com.alsorg.packing.hrflow.domain.HrEmployee;
import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import com.alsorg.packing.hrflow.domain.HrJoiningReport;
import com.alsorg.packing.hrflow.domain.HrOnboardingCase;
import com.alsorg.packing.hrflow.domain.HrOnboardingStatus;
import com.alsorg.packing.hrflow.dto.HrDocumentDtos;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.dto.HrOnboardingDtos;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrEmployeeRepository;
import com.alsorg.packing.hrflow.repository.HrJoiningReportRepository;
import com.alsorg.packing.hrflow.repository.HrOnboardingCaseRepository;
import com.alsorg.packing.hrflow.security.HrAccessService;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class HrOnboardingService {

    private static final EnumSet<HrCandidateStage> ONBOARDABLE_STAGES = EnumSet.of(
            HrCandidateStage.SELECTED,
            HrCandidateStage.OFFERED,
            HrCandidateStage.PRE_JOINING
    );

    private static final Set<String> FEEDBACK_ANSWERS = Set.of("Y", "N", "NA");

    private static final List<HrOnboardingDtos.FeedbackQuestion> FEEDBACK_QUESTIONS = List.of(
            new HrOnboardingDtos.FeedbackQuestion("F01", "Did you get assistance when you asked for it during your induction training?"),
            new HrOnboardingDtos.FeedbackQuestion("F02", "Was the process of completing joining formalities OK?"),
            new HrOnboardingDtos.FeedbackQuestion("F03", "Did you get sufficient information in understanding the company's rules, regulations, policies and schemes?"),
            new HrOnboardingDtos.FeedbackQuestion("F04", "Were you introduced to your fellow colleagues?"),
            new HrOnboardingDtos.FeedbackQuestion("F05", "Were you introduced to your HOD?"),
            new HrOnboardingDtos.FeedbackQuestion("F06", "Did you get relevant information about your job?"),
            new HrOnboardingDtos.FeedbackQuestion("F07", "Are you clear about your reporting relationship?"),
            new HrOnboardingDtos.FeedbackQuestion("F08", "Are you clear about the job expectations from you?"),
            new HrOnboardingDtos.FeedbackQuestion("F09", "Have you visited the relevant plant, company or showroom areas?"),
            new HrOnboardingDtos.FeedbackQuestion("F10", "Are you clear about the company's products and services?"),
            new HrOnboardingDtos.FeedbackQuestion("F11", "Did you find the induction program useful in helping you adapt to the organization?")
    );

    private final HrOnboardingCaseRepository onboardingRepository;
    private final HrEmployeeRepository employeeRepository;
    private final HrJoiningReportRepository joiningReportRepository;
    private final HrAccessService accessService;
    private final HrAuditService auditService;
    private final HrDocumentService documentService;
    private final HrCandidateTokenService tokenService;
    private final HrFlowProperties properties;
    private final EntityManager entityManager;

    public HrOnboardingService(
            HrOnboardingCaseRepository onboardingRepository,
            HrEmployeeRepository employeeRepository,
            HrJoiningReportRepository joiningReportRepository,
            HrAccessService accessService,
            HrAuditService auditService,
            HrDocumentService documentService,
            HrCandidateTokenService tokenService,
            HrFlowProperties properties,
            EntityManager entityManager
    ) {
        this.onboardingRepository = onboardingRepository;
        this.employeeRepository = employeeRepository;
        this.joiningReportRepository = joiningReportRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.documentService = documentService;
        this.tokenService = tokenService;
        this.properties = properties;
        this.entityManager = entityManager;
    }

    @Transactional
    public HrOnboardingDtos.OnboardingDetailResponse createFromCandidate(
            UUID candidateId,
            HrOnboardingDtos.CreateOnboardingRequest request
    ) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE
        );

        HrCandidate candidate = requireCandidate(candidateId);
        if (!ONBOARDABLE_STAGES.contains(candidate.getStage())) {
            throw HrFlowException.conflict(
                    "Only SELECTED, OFFERED or PRE_JOINING candidates can enter onboarding."
            );
        }

        if (onboardingRepository.findByCandidateId(candidateId).isPresent()) {
            throw HrFlowException.conflict("An onboarding case already exists for this candidate.");
        }

        String actor = accessService.actor();

        HrOnboardingCase onboarding = new HrOnboardingCase();
        onboarding.setCandidateId(candidateId);
        onboarding.setStatus(HrOnboardingStatus.OPEN);
        onboarding.setJoiningDate(
                request != null && request.joiningDate() != null
                        ? request.joiningDate()
                        : candidate.getProposedJoiningDate()
        );
        onboarding.setDepartment(firstNonBlank(
                request == null ? null : request.department(),
                candidate.getDepartment()
        ));
        onboarding.setDesignation(firstNonBlank(
                request == null ? null : request.designation(),
                candidate.getDesignation(),
                candidate.getPostAppliedFor()
        ));
        onboarding.setLocation(clean(request == null ? null : request.location()));
        onboarding.setReportingManager(clean(request == null ? null : request.reportingManager()));
        onboarding.setAppointedBy(firstNonBlank(
                request == null ? null : request.appointedBy(),
                candidate.getAppointedBy()
        ));
        onboarding.setRemarks(clean(request == null ? null : request.remarks()));
        onboarding.setCreatedBy(actor);
        onboarding.setUpdatedBy(actor);

        requireEmploymentFields(onboarding);
        onboarding = onboardingRepository.save(onboarding);

        candidate.setStage(HrCandidateStage.PRE_JOINING);
        candidate.setDepartment(onboarding.getDepartment());
        candidate.setDesignation(onboarding.getDesignation());
        candidate.setProposedJoiningDate(onboarding.getJoiningDate());
        candidate.setAppointedBy(onboarding.getAppointedBy());
        candidate.setUpdatedBy(actor);

        ensureOrientationState(candidate.getId(), actor);

        auditService.log(
                HrAuditAction.ONBOARDING_CASE_CREATED,
                "CANDIDATE",
                candidateId.toString(),
                actor,
                "Onboarding case created.",
                "{\"onboardingCaseId\":\"" + onboarding.getId() + "\"}"
        );

        return toDetail(onboarding, candidate);
    }

    @Transactional(readOnly = true)
    public Page<HrOnboardingDtos.OnboardingSummaryResponse> list(
            HrOnboardingStatus status,
            Pageable pageable
    ) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );

        return onboardingRepository.search(status, pageable).map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.OnboardingDetailResponse get(UUID id) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );
        HrOnboardingCase onboarding = requireOnboarding(id);
        return toDetail(onboarding, requireCandidate(onboarding.getCandidateId()));
    }

    @Transactional
    public HrOnboardingDtos.OnboardingDetailResponse update(
            UUID id,
            HrOnboardingDtos.UpdateOnboardingRequest request
    ) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE
        );

        if (request == null) {
            throw HrFlowException.badRequest("Onboarding update is required.");
        }

        HrOnboardingCase onboarding = requireOnboarding(id);
        if (onboarding.getStatus() == HrOnboardingStatus.JOINED
                || onboarding.getStatus() == HrOnboardingStatus.ONBOARDING_COMPLETE) {
            throw HrFlowException.conflict(
                    "Core employment details are locked after joining. Use the onboarding workflow actions for remaining induction steps."
            );
        }
        assertRowVersion(onboarding, request.rowVersion());

        if (request.status() != null) {
            if (request.status() == HrOnboardingStatus.JOINED
                    || request.status() == HrOnboardingStatus.ONBOARDING_COMPLETE) {
                throw HrFlowException.conflict(
                        "JOINED and ONBOARDING_COMPLETE are controlled by workflow actions."
                );
            }
            onboarding.setStatus(request.status());
        }
        if (request.joiningDate() != null) onboarding.setJoiningDate(request.joiningDate());
        if (request.department() != null) onboarding.setDepartment(clean(request.department()));
        if (request.designation() != null) onboarding.setDesignation(clean(request.designation()));
        if (request.location() != null) onboarding.setLocation(clean(request.location()));
        if (request.reportingManager() != null) onboarding.setReportingManager(clean(request.reportingManager()));
        if (request.appointedBy() != null) onboarding.setAppointedBy(clean(request.appointedBy()));
        if (request.remarks() != null) onboarding.setRemarks(clean(request.remarks()));

        requireEmploymentFields(onboarding);

        String actor = accessService.actor();
        onboarding.setUpdatedBy(actor);

        HrCandidate candidate = requireCandidate(onboarding.getCandidateId());
        candidate.setDepartment(onboarding.getDepartment());
        candidate.setDesignation(onboarding.getDesignation());
        candidate.setProposedJoiningDate(onboarding.getJoiningDate());
        candidate.setAppointedBy(onboarding.getAppointedBy());
        candidate.setUpdatedBy(actor);

        auditService.log(
                HrAuditAction.ONBOARDING_CASE_UPDATED,
                "CANDIDATE",
                candidate.getId().toString(),
                actor,
                "Onboarding case updated.",
                "{\"onboardingCaseId\":\"" + onboarding.getId() + "\"}"
        );

        return toDetail(onboarding, candidate);
    }

    @Transactional
    public HrOnboardingDtos.PortalLinkResponse createPortalLink(UUID onboardingId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE
        );

        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        if (onboarding.getStatus() == HrOnboardingStatus.CANCELLED) {
            throw HrFlowException.conflict("A portal link cannot be created for a cancelled onboarding case.");
        }

        HrCandidate candidate = requireCandidate(onboarding.getCandidateId());
        String actor = accessService.actor();
        HrCandidateTokenService.IssuedToken issued = tokenService.issueOnboardingToken(candidate, actor);

        auditService.log(
                HrAuditAction.ONBOARDING_LINK_CREATED,
                "CANDIDATE",
                candidate.getId().toString(),
                actor,
                "Secure onboarding portal link created.",
                "{\"onboardingCaseId\":\"" + onboarding.getId() + "\"}"
        );

        return new HrOnboardingDtos.PortalLinkResponse(
                onboarding.getId(),
                candidate.getId(),
                candidate.getCandidateNumber(),
                issued.rawToken(),
                issued.expiresAt()
        );
    }

    @Transactional
    public HrEmployeeDtos.EmployeeDetailResponse confirmJoining(
            UUID onboardingId,
            HrOnboardingDtos.ConfirmJoiningRequest request
    ) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE
        );

        HrOnboardingCase onboarding = requireOnboarding(onboardingId);

        if (onboarding.getStatus() == HrOnboardingStatus.JOINED
                || onboarding.getStatus() == HrOnboardingStatus.ONBOARDING_COMPLETE
                || onboarding.getEmployeeId() != null) {
            throw HrFlowException.conflict("Joining has already been confirmed for this onboarding case.");
        }
        if (onboarding.getStatus() == HrOnboardingStatus.CANCELLED) {
            throw HrFlowException.conflict("A cancelled onboarding case cannot be joined.");
        }

        HrCandidate candidate = requireCandidate(onboarding.getCandidateId());
        if (candidate.getStage() != HrCandidateStage.PRE_JOINING
                && candidate.getStage() != HrCandidateStage.OFFERED
                && candidate.getStage() != HrCandidateStage.SELECTED) {
            throw HrFlowException.conflict("Candidate is not in a joinable recruitment stage.");
        }

        if (!requiredIdentityDocumentsComplete(candidate)) {
            throw HrFlowException.conflict(
                    "Required identity documents are incomplete. Complete the required photo/Aadhaar"
                            + (candidate.getApplicationType() == HrApplicationType.MANAGERIAL_ADMINISTRATIVE ? "/PAN" : "")
                            + " documents before confirming joining."
            );
        }

        LocalDate joiningDate = request != null && request.joiningDate() != null
                ? request.joiningDate()
                : onboarding.getJoiningDate();
        if (joiningDate == null) joiningDate = LocalDate.now();

        String employeeCode = clean(request == null ? null : request.employeeCode());
        if (employeeCode == null) employeeCode = generateEmployeeCode();
        employeeCode = employeeCode.toUpperCase(Locale.ROOT);

        if (employeeRepository.existsByEmployeeCodeIgnoreCase(employeeCode)) {
            throw HrFlowException.conflict("Employee code already exists: " + employeeCode);
        }
        if (employeeRepository.findByCandidateId(candidate.getId()).isPresent()) {
            throw HrFlowException.conflict("An employee already exists for this candidate.");
        }

        requireEmploymentFields(onboarding);
        String actor = accessService.actor();

        HrEmployee employee = new HrEmployee();
        employee.setCandidateId(candidate.getId());
        employee.setEmployeeCode(employeeCode);
        employee.setStatus(HrEmployeeStatus.ACTIVE);
        employee.setFullName(required(candidate.getFullName(), "Candidate name is required before joining."));
        employee.setFatherOrHusbandName(clean(candidate.getFatherOrHusbandName()));
        employee.setDateOfBirth(candidate.getDateOfBirth());
        employee.setEmail(clean(candidate.getEmail()));
        employee.setMobileNo(clean(candidate.getMobileNo()));
        employee.setPresentAddress(clean(candidate.getPresentAddress()));
        employee.setPermanentAddress(clean(candidate.getPermanentAddress()));
        employee.setDepartment(onboarding.getDepartment());
        employee.setDesignation(onboarding.getDesignation());
        employee.setLocation(clean(onboarding.getLocation()));
        employee.setReportingManager(clean(onboarding.getReportingManager()));
        employee.setAppointedBy(clean(onboarding.getAppointedBy()));
        employee.setDateOfJoining(joiningDate);
        employee.setCreatedBy(actor);
        employee.setUpdatedBy(actor);
        employee = employeeRepository.save(employee);

        boolean acknowledged = request != null && Boolean.TRUE.equals(request.employeeAcknowledged());

        HrJoiningReport report = new HrJoiningReport();
        report.setOnboardingCaseId(onboarding.getId());
        report.setEmployeeId(employee.getId());
        report.setCandidateId(candidate.getId());
        report.setEmployeeCode(employee.getEmployeeCode());
        report.setEmployeeName(employee.getFullName());
        report.setFatherName(employee.getFatherOrHusbandName());
        report.setDesignation(employee.getDesignation());
        report.setDepartment(employee.getDepartment());
        report.setJoiningDate(joiningDate);
        report.setEmployeeAcknowledged(acknowledged);
        report.setEmployeeAcknowledgedAt(acknowledged ? LocalDateTime.now() : null);
        report.setConfirmedBy(actor);
        report = joiningReportRepository.save(report);

        onboarding.setStatus(HrOnboardingStatus.JOINED);
        onboarding.setJoiningDate(joiningDate);
        onboarding.setEmployeeId(employee.getId());
        onboarding.setUpdatedBy(actor);

        candidate.setStage(HrCandidateStage.JOINED);
        candidate.setProposedJoiningDate(joiningDate);
        candidate.setDepartment(employee.getDepartment());
        candidate.setDesignation(employee.getDesignation());
        candidate.setUpdatedBy(actor);

        HrOnboardingDtos.JoiningReportResponse reportResponse = toJoiningReport(report);
        documentService.storeGeneratedJson(
                candidate.getId(),
                HrDocumentType.JOINING_REPORT_SNAPSHOT,
                reportResponse,
                false,
                actor,
                "Frozen joining report snapshot"
        );

        auditService.log(
                HrAuditAction.EMPLOYEE_CREATED,
                "EMPLOYEE",
                employee.getId().toString(),
                actor,
                "Employee created from candidate " + candidate.getCandidateNumber() + ".",
                "{\"candidateId\":\"" + candidate.getId() + "\"}"
        );

        auditService.log(
                HrAuditAction.JOINING_CONFIRMED,
                "CANDIDATE",
                candidate.getId().toString(),
                actor,
                "Joining confirmed. Employee code: " + employee.getEmployeeCode(),
                "{\"employeeId\":\"" + employee.getId() + "\",\"onboardingCaseId\":\"" + onboarding.getId() + "\"}"
        );

        return toEmployeeDetail(employee);
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.JoiningReportResponse joiningReport(UUID onboardingId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );
        requireOnboarding(onboardingId);

        HrJoiningReport report = joiningReportRepository.findByOnboardingCaseId(onboardingId)
                .orElseThrow(() -> HrFlowException.notFound("Joining report has not been created yet."));
        return toJoiningReport(report);
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.JoiningReportResponse publicJoiningReport(HrCandidate candidate) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        return joiningReportRepository.findByOnboardingCaseId(onboarding.getId())
                .map(this::toJoiningReport)
                .orElseThrow(() -> HrFlowException.notFound("Joining report has not been created yet."));
    }

    @Transactional
    public HrOnboardingDtos.JoiningReportResponse acknowledgeJoining(HrCandidate candidate) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        HrJoiningReport report = joiningReportRepository.findByOnboardingCaseId(onboarding.getId())
                .orElseThrow(() -> HrFlowException.notFound("Joining report has not been created yet."));

        if (!report.isEmployeeAcknowledged()) {
            report.setEmployeeAcknowledged(true);
            report.setEmployeeAcknowledgedAt(LocalDateTime.now());

            auditService.log(
                    HrAuditAction.JOINING_ACKNOWLEDGED,
                    "CANDIDATE",
                    candidate.getId().toString(),
                    "CANDIDATE",
                    "Employee acknowledged the joining report.",
                    "{\"joiningReportId\":\"" + report.getId() + "\"}"
            );
        }

        return toJoiningReport(report);
    }

    // -------------------------------------------------------------------------
    // Versioned policy / NDA / declaration snapshots
    // -------------------------------------------------------------------------

    @Transactional
    public HrOnboardingDtos.LegalSnapshotResponse setPolicy(
            UUID onboardingId,
            HrOnboardingDtos.LegalSnapshotRequest request
    ) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD);
        return setLegalSnapshot(
                onboardingId,
                request,
                HrDocumentType.ONBOARDING_POLICY_SNAPSHOT,
                HrAuditAction.POLICY_SNAPSHOT_UPDATED,
                "Holiday & Leave / HR Policy"
        );
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.LegalSnapshotResponse getPolicy(UUID onboardingId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );
        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        return latestLegalSnapshot(onboarding.getCandidateId(), HrDocumentType.ONBOARDING_POLICY_SNAPSHOT).orElse(null);
    }

    @Transactional
    public HrOnboardingDtos.LegalSnapshotResponse setNda(
            UUID onboardingId,
            HrOnboardingDtos.LegalSnapshotRequest request
    ) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD);
        return setLegalSnapshot(
                onboardingId,
                request,
                HrDocumentType.NDA_SNAPSHOT,
                HrAuditAction.NDA_SNAPSHOT_UPDATED,
                "Mutual Non-Disclosure Agreement"
        );
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.LegalSnapshotResponse getNda(UUID onboardingId) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE);
        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        return latestLegalSnapshot(onboarding.getCandidateId(), HrDocumentType.NDA_SNAPSHOT).orElse(null);
    }

    @Transactional
    public HrOnboardingDtos.AgreementAcceptanceResponse verifyNda(UUID onboardingId) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD);
        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        requireWorkflowOpen(onboarding);

        UUID candidateId = onboarding.getCandidateId();
        HrOnboardingDtos.LegalSnapshotResponse snapshot = latestLegalSnapshot(candidateId, HrDocumentType.NDA_SNAPSHOT)
                .orElseThrow(() -> HrFlowException.conflict("Publish the NDA snapshot before verification."));

        HrOnboardingDtos.AgreementAcceptanceResponse acceptance = currentAcceptance(
                candidateId,
                HrDocumentType.NDA_ACCEPTANCE,
                snapshot.snapshotSha256()
        ).orElseThrow(() -> HrFlowException.conflict("The employee must accept the current NDA before HR verification."));

        Optional<HrOnboardingDtos.AgreementAcceptanceResponse> existing = currentAcceptance(
                candidateId,
                HrDocumentType.NDA_VERIFICATION,
                snapshot.snapshotSha256()
        );
        if (existing.isPresent()) return existing.get();

        String actor = accessService.actor();
        LocalDateTime now = LocalDateTime.now();
        AcceptancePayload payload = new AcceptancePayload(
                snapshot.version(),
                snapshot.title(),
                snapshot.body(),
                snapshot.snapshotSha256(),
                acceptance.typedName(),
                acceptance.acceptedBy(),
                acceptance.acceptedAt(),
                actor,
                now
        );

        HrDocumentDtos.DocumentResponse stored = documentService.storeGeneratedJson(
                candidateId,
                HrDocumentType.NDA_VERIFICATION,
                payload,
                false,
                actor,
                "NDA verified by HR/Admin Head"
        );

        auditService.log(
                HrAuditAction.NDA_VERIFIED,
                "CANDIDATE",
                candidateId.toString(),
                actor,
                "Current NDA acceptance verified.",
                "{\"snapshotSha256\":\"" + snapshot.snapshotSha256() + "\"}"
        );

        return acceptanceResponse(stored, payload);
    }

    @Transactional
    public HrOnboardingDtos.LegalSnapshotResponse setDeclaration(
            UUID onboardingId,
            HrOnboardingDtos.LegalSnapshotRequest request
    ) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD);
        return setLegalSnapshot(
                onboardingId,
                request,
                HrDocumentType.EMPLOYMENT_DECLARATION_SNAPSHOT,
                HrAuditAction.DECLARATION_SNAPSHOT_UPDATED,
                "Employment Declaration"
        );
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.LegalSnapshotResponse getDeclaration(UUID onboardingId) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE);
        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        return latestLegalSnapshot(onboarding.getCandidateId(), HrDocumentType.EMPLOYMENT_DECLARATION_SNAPSHOT).orElse(null);
    }

    @Transactional
    public HrOnboardingDtos.AgreementAcceptanceResponse acknowledgePolicy(
            HrCandidate candidate,
            HrOnboardingDtos.AcceptanceRequest request
    ) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        return acceptCurrentLegal(
                onboarding,
                request,
                HrDocumentType.ONBOARDING_POLICY_SNAPSHOT,
                HrDocumentType.ONBOARDING_POLICY_ACKNOWLEDGEMENT,
                HrAuditAction.POLICY_ACKNOWLEDGED,
                "Policy acknowledged"
        );
    }

    @Transactional
    public HrOnboardingDtos.AgreementAcceptanceResponse acceptNda(
            HrCandidate candidate,
            HrOnboardingDtos.AcceptanceRequest request
    ) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        return acceptCurrentLegal(
                onboarding,
                request,
                HrDocumentType.NDA_SNAPSHOT,
                HrDocumentType.NDA_ACCEPTANCE,
                HrAuditAction.NDA_ACCEPTED,
                "NDA accepted"
        );
    }

    @Transactional
    public HrOnboardingDtos.AgreementAcceptanceResponse acceptDeclaration(
            HrCandidate candidate,
            HrOnboardingDtos.AcceptanceRequest request
    ) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        return acceptCurrentLegal(
                onboarding,
                request,
                HrDocumentType.EMPLOYMENT_DECLARATION_SNAPSHOT,
                HrDocumentType.EMPLOYMENT_DECLARATION_ACCEPTANCE,
                HrAuditAction.DECLARATION_ACCEPTED,
                "Employment declaration accepted"
        );
    }

    // -------------------------------------------------------------------------
    // Orientation checklist + induction feedback
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public HrOnboardingDtos.OrientationResponse orientation(UUID onboardingId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );
        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        return orientationResponse(onboarding.getCandidateId());
    }

    @Transactional
    public HrOnboardingDtos.OrientationResponse updateOrientation(
            UUID onboardingId,
            HrOnboardingDtos.OrientationUpdateRequest request
    ) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );

        if (request == null || request.tasks() == null || request.tasks().isEmpty()) {
            throw HrFlowException.badRequest("At least one orientation task update is required.");
        }

        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        requireWorkflowOpen(onboarding);
        UUID candidateId = onboarding.getCandidateId();

        if (documentService.hasActive(candidateId, HrDocumentType.ORIENTATION_RECORD)) {
            throw HrFlowException.conflict("Orientation has already been acknowledged and finalized.");
        }

        HrDocumentService.GeneratedJson<OrientationPayload> current = latestOrientationState(candidateId)
                .orElseGet(() -> ensureOrientationState(candidateId, accessService.actor()));

        if (clean(request.expectedStateSha256()) != null
                && !request.expectedStateSha256().equalsIgnoreCase(current.document().sha256())) {
            throw HrFlowException.conflict(
                    "The orientation checklist changed after it was opened. Refresh and try again."
            );
        }

        Map<String, HrOnboardingDtos.OrientationTaskUpdate> updates = request.tasks().stream()
                .filter(Objects::nonNull)
                .filter(x -> clean(x.code()) != null)
                .collect(Collectors.toMap(
                        x -> x.code().trim().toUpperCase(Locale.ROOT),
                        Function.identity(),
                        (a, b) -> b,
                        LinkedHashMap::new
                ));

        Map<String, HrOnboardingDtos.OrientationTask> existingByCode = current.payload().tasks().stream()
                .collect(Collectors.toMap(
                        x -> x.code().toUpperCase(Locale.ROOT),
                        Function.identity(),
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        for (String code : updates.keySet()) {
            if (!existingByCode.containsKey(code)) {
                throw HrFlowException.badRequest("Unknown orientation task code: " + code);
            }
        }

        boolean hodOnly = isHodOnly();
        String actor = accessService.actor();
        LocalDateTime now = LocalDateTime.now();
        List<HrOnboardingDtos.OrientationTask> revised = new ArrayList<>();

        for (HrOnboardingDtos.OrientationTask task : current.payload().tasks()) {
            HrOnboardingDtos.OrientationTaskUpdate change = updates.get(task.code().toUpperCase(Locale.ROOT));
            if (change == null) {
                revised.add(task);
                continue;
            }

            if (hodOnly && !"DEPARTMENT".equals(task.section()) && !"VISIT".equals(task.section())) {
                throw HrFlowException.forbidden(
                        "HOD access can update only DEPARTMENT and VISIT orientation tasks."
                );
            }

            boolean completed = change.completed() == null ? task.completed() : change.completed();
            revised.add(new HrOnboardingDtos.OrientationTask(
                    task.code(),
                    task.section(),
                    task.label(),
                    task.required(),
                    completed,
                    completed ? (task.completed() ? task.completedBy() : actor) : null,
                    completed ? (task.completed() ? task.completedAt() : now) : null,
                    change.remarks() != null ? clean(change.remarks()) : task.remarks(),
                    change.visitDate() != null ? change.visitDate() : task.visitDate(),
                    change.assistedBy() != null ? clean(change.assistedBy()) : task.assistedBy()
            ));
        }

        OrientationPayload payload = new OrientationPayload(
                current.payload().version(),
                revised,
                false,
                null,
                null,
                now
        );

        HrDocumentDtos.DocumentResponse stored = documentService.storeGeneratedJson(
                candidateId,
                HrDocumentType.ORIENTATION_STATE,
                payload,
                true,
                actor,
                "Current employee orientation checklist state"
        );

        auditService.log(
                HrAuditAction.ORIENTATION_UPDATED,
                "CANDIDATE",
                candidateId.toString(),
                actor,
                "Employee orientation checklist updated.",
                null
        );

        return orientationResponse(stored, payload);
    }

    @Transactional(readOnly = true)
    public List<HrOnboardingDtos.FeedbackQuestion> feedbackQuestions() {
        return FEEDBACK_QUESTIONS;
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.FeedbackSubmissionResponse feedback(UUID onboardingId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );
        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        return latestFeedback(onboarding.getCandidateId()).orElse(null);
    }

    @Transactional
    public HrOnboardingDtos.OrientationResponse acknowledgeOrientation(
            HrCandidate candidate,
            HrOnboardingDtos.OrientationAcknowledgeRequest request
    ) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        requireWorkflowOpen(onboarding);

        if (request == null || !Boolean.TRUE.equals(request.acknowledged())) {
            throw HrFlowException.badRequest("Orientation acknowledgement is required.");
        }
        String typedName = required(request.typedName(), "Please enter your name to acknowledge orientation.");

        UUID candidateId = candidate.getId();
        Optional<HrDocumentService.GeneratedJson<OrientationPayload>> existingRecord =
                documentService.latestGeneratedJson(candidateId, HrDocumentType.ORIENTATION_RECORD, OrientationPayload.class);
        if (existingRecord.isPresent()) {
            return orientationResponse(existingRecord.get().document(), existingRecord.get().payload());
        }

        HrDocumentService.GeneratedJson<OrientationPayload> current = latestOrientationState(candidateId)
                .orElseGet(() -> ensureOrientationState(candidateId, "SYSTEM"));

        if (!allRequiredOrientationComplete(current.payload().tasks())) {
            throw HrFlowException.conflict("All required orientation tasks must be completed before acknowledgement.");
        }

        LocalDateTime now = LocalDateTime.now();
        OrientationPayload finalPayload = new OrientationPayload(
                current.payload().version(),
                current.payload().tasks(),
                true,
                typedName,
                now,
                now
        );

        HrDocumentDtos.DocumentResponse state = documentService.storeGeneratedJson(
                candidateId,
                HrDocumentType.ORIENTATION_STATE,
                finalPayload,
                true,
                "CANDIDATE",
                "Employee acknowledged completed orientation"
        );

        documentService.storeGeneratedJson(
                candidateId,
                HrDocumentType.ORIENTATION_RECORD,
                finalPayload,
                false,
                "CANDIDATE",
                "Frozen completed orientation record"
        );

        auditService.log(
                HrAuditAction.ORIENTATION_ACKNOWLEDGED,
                "CANDIDATE",
                candidateId.toString(),
                "CANDIDATE",
                "Employee acknowledged the completed orientation checklist.",
                null
        );

        return orientationResponse(state, finalPayload);
    }

    @Transactional
    public HrOnboardingDtos.FeedbackSubmissionResponse submitFeedback(
            HrCandidate candidate,
            HrOnboardingDtos.FeedbackSubmissionRequest request
    ) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        requireWorkflowOpen(onboarding);

        UUID candidateId = candidate.getId();
        Optional<HrOnboardingDtos.FeedbackSubmissionResponse> existing = latestFeedback(candidateId);
        if (existing.isPresent()) return existing.get();

        if (request == null || request.answers() == null) {
            throw HrFlowException.badRequest("Induction feedback answers are required.");
        }

        Map<String, HrOnboardingDtos.FeedbackAnswerRequest> supplied = request.answers().stream()
                .filter(Objects::nonNull)
                .filter(x -> clean(x.code()) != null)
                .collect(Collectors.toMap(
                        x -> x.code().trim().toUpperCase(Locale.ROOT),
                        Function.identity(),
                        (a, b) -> b,
                        LinkedHashMap::new
                ));

        List<HrOnboardingDtos.FeedbackAnswer> normalized = new ArrayList<>();
        for (HrOnboardingDtos.FeedbackQuestion q : FEEDBACK_QUESTIONS) {
            HrOnboardingDtos.FeedbackAnswerRequest suppliedAnswer = supplied.get(q.code());
            if (suppliedAnswer == null) {
                throw HrFlowException.badRequest("Feedback answer is required for " + q.code() + ".");
            }
            String answer = required(suppliedAnswer.answer(), "Feedback answer is required for " + q.code() + ".")
                    .toUpperCase(Locale.ROOT)
                    .replace("/", "");
            if (!FEEDBACK_ANSWERS.contains(answer)) {
                throw HrFlowException.badRequest("Feedback answer for " + q.code() + " must be Y, N or NA.");
            }
            normalized.add(new HrOnboardingDtos.FeedbackAnswer(
                    q.code(),
                    q.question(),
                    answer,
                    clean(suppliedAnswer.suggestion())
            ));
        }

        FeedbackPayload payload = new FeedbackPayload(normalized, "CANDIDATE", LocalDateTime.now());
        HrDocumentDtos.DocumentResponse stored = documentService.storeGeneratedJson(
                candidateId,
                HrDocumentType.INDUCTION_FEEDBACK,
                payload,
                false,
                "CANDIDATE",
                "Employee induction feedback"
        );

        auditService.log(
                HrAuditAction.INDUCTION_FEEDBACK_SUBMITTED,
                "CANDIDATE",
                candidateId.toString(),
                "CANDIDATE",
                "Employee submitted induction feedback.",
                null
        );

        return feedbackResponse(stored, payload);
    }

    // -------------------------------------------------------------------------
    // Completion / portal aggregate
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public HrOnboardingDtos.CompletionResponse completion(UUID onboardingId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );
        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        HrCandidate candidate = requireCandidate(onboarding.getCandidateId());
        return completionResponse(onboarding, candidate);
    }

    @Transactional
    public HrOnboardingDtos.CompletionResponse completeOnboarding(UUID onboardingId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE
        );

        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        if (onboarding.getStatus() == HrOnboardingStatus.CANCELLED) {
            throw HrFlowException.conflict("A cancelled onboarding case cannot be completed.");
        }

        HrCandidate candidate = requireCandidate(onboarding.getCandidateId());
        HrOnboardingDtos.CompletionResponse result = completionResponse(onboarding, candidate);
        if (!result.complete()) {
            throw HrFlowException.conflict(
                    "Onboarding cannot be completed. Pending: " + String.join(", ", result.pending())
            );
        }

        if (onboarding.getStatus() != HrOnboardingStatus.ONBOARDING_COMPLETE) {
            String actor = accessService.actor();
            onboarding.setStatus(HrOnboardingStatus.ONBOARDING_COMPLETE);
            onboarding.setUpdatedBy(actor);

            HrOnboardingDtos.CompletionResponse frozenCompletion = completionResponse(onboarding, candidate);
            CompletionPayload payload = new CompletionPayload(
                    onboarding.getId(),
                    candidate.getId(),
                    frozenCompletion,
                    actor,
                    LocalDateTime.now()
            );
            documentService.storeGeneratedJson(
                    candidate.getId(),
                    HrDocumentType.ONBOARDING_COMPLETION_RECORD,
                    payload,
                    false,
                    actor,
                    "Final HRFLOW onboarding completion record"
            );

            auditService.log(
                    HrAuditAction.ONBOARDING_COMPLETED,
                    "CANDIDATE",
                    candidate.getId().toString(),
                    actor,
                    "Employee onboarding completed.",
                    "{\"onboardingCaseId\":\"" + onboarding.getId() + "\"}"
            );
        }

        return completionResponse(onboarding, candidate);
    }

    @Transactional(readOnly = true)
    public HrOnboardingDtos.OnboardingPortalResponse publicPortal(HrCandidate candidate) {
        HrOnboardingCase onboarding = requirePortalOnboarding(candidate);
        UUID candidateId = candidate.getId();

        HrOnboardingDtos.JoiningReportResponse joining = joiningReportRepository.findByOnboardingCaseId(onboarding.getId())
                .map(this::toJoiningReport)
                .orElse(null);

        HrOnboardingDtos.LegalSnapshotResponse policy =
                latestLegalSnapshot(candidateId, HrDocumentType.ONBOARDING_POLICY_SNAPSHOT).orElse(null);
        HrOnboardingDtos.AgreementAcceptanceResponse policyAck = policy == null
                ? null
                : currentAcceptance(candidateId, HrDocumentType.ONBOARDING_POLICY_ACKNOWLEDGEMENT, policy.snapshotSha256()).orElse(null);

        HrOnboardingDtos.LegalSnapshotResponse nda =
                latestLegalSnapshot(candidateId, HrDocumentType.NDA_SNAPSHOT).orElse(null);
        HrOnboardingDtos.AgreementAcceptanceResponse ndaAcceptance = nda == null
                ? null
                : currentAcceptance(candidateId, HrDocumentType.NDA_ACCEPTANCE, nda.snapshotSha256()).orElse(null);
        HrOnboardingDtos.AgreementAcceptanceResponse ndaVerification = nda == null
                ? null
                : currentAcceptance(candidateId, HrDocumentType.NDA_VERIFICATION, nda.snapshotSha256()).orElse(null);

        HrOnboardingDtos.LegalSnapshotResponse declaration =
                latestLegalSnapshot(candidateId, HrDocumentType.EMPLOYMENT_DECLARATION_SNAPSHOT).orElse(null);
        HrOnboardingDtos.AgreementAcceptanceResponse declarationAcceptance = declaration == null
                ? null
                : currentAcceptance(candidateId, HrDocumentType.EMPLOYMENT_DECLARATION_ACCEPTANCE, declaration.snapshotSha256()).orElse(null);

        return new HrOnboardingDtos.OnboardingPortalResponse(
                onboarding.getId(),
                candidateId,
                candidate.getCandidateNumber(),
                candidate.getFullName(),
                onboarding.getStatus(),
                onboarding.getJoiningDate(),
                onboarding.getDepartment(),
                onboarding.getDesignation(),
                onboarding.getLocation(),
                onboarding.getReportingManager(),
                joining,
                policy,
                policyAck,
                nda,
                ndaAcceptance,
                ndaVerification,
                declaration,
                declarationAcceptance,
                orientationResponse(candidateId),
                FEEDBACK_QUESTIONS,
                latestFeedback(candidateId).orElse(null),
                completionResponse(onboarding, candidate)
        );
    }

    // -------------------------------------------------------------------------
    // Legal helpers
    // -------------------------------------------------------------------------

    private HrOnboardingDtos.LegalSnapshotResponse setLegalSnapshot(
            UUID onboardingId,
            HrOnboardingDtos.LegalSnapshotRequest request,
            HrDocumentType snapshotType,
            HrAuditAction action,
            String defaultTitle
    ) {
        if (request == null) {
            throw HrFlowException.badRequest("Versioned document content is required.");
        }

        HrOnboardingCase onboarding = requireOnboarding(onboardingId);
        requireWorkflowOpen(onboarding);

        String version = required(request.version(), "Document version is required.");
        String title = firstNonBlank(request.title(), defaultTitle);
        String body = required(request.body(), "Document text is required.");
        String snapshotSha = documentService.sha256Text(version + "\n" + title + "\n" + body);

        Optional<HrOnboardingDtos.LegalSnapshotResponse> current = latestLegalSnapshot(
                onboarding.getCandidateId(), snapshotType
        );
        if (current.isPresent() && snapshotSha.equalsIgnoreCase(current.get().snapshotSha256())) {
            return current.get();
        }

        String actor = accessService.actor();
        LegalSnapshotPayload payload = new LegalSnapshotPayload(
                version,
                title,
                body,
                snapshotSha,
                actor,
                LocalDateTime.now()
        );

        HrDocumentDtos.DocumentResponse stored = documentService.storeGeneratedJson(
                onboarding.getCandidateId(),
                snapshotType,
                payload,
                true,
                actor,
                title + " version " + version
        );

        auditService.log(
                action,
                "CANDIDATE",
                onboarding.getCandidateId().toString(),
                actor,
                title + " snapshot published/updated. Version: " + version,
                "{\"snapshotSha256\":\"" + snapshotSha + "\"}"
        );

        return legalSnapshotResponse(stored, payload);
    }

    private HrOnboardingDtos.AgreementAcceptanceResponse acceptCurrentLegal(
            HrOnboardingCase onboarding,
            HrOnboardingDtos.AcceptanceRequest request,
            HrDocumentType snapshotType,
            HrDocumentType acceptanceType,
            HrAuditAction action,
            String auditMessage
    ) {
        requireWorkflowOpen(onboarding);
        if (request == null || !Boolean.TRUE.equals(request.accepted())) {
            throw HrFlowException.badRequest("Acceptance is required.");
        }

        String typedName = required(request.typedName(), "Please enter your name to accept this document.");
        UUID candidateId = onboarding.getCandidateId();

        HrOnboardingDtos.LegalSnapshotResponse snapshot = latestLegalSnapshot(candidateId, snapshotType)
                .orElseThrow(() -> HrFlowException.conflict("HR has not published the current document yet."));

        Optional<HrOnboardingDtos.AgreementAcceptanceResponse> existing =
                currentAcceptance(candidateId, acceptanceType, snapshot.snapshotSha256());
        if (existing.isPresent()) return existing.get();

        AcceptancePayload payload = new AcceptancePayload(
                snapshot.version(),
                snapshot.title(),
                snapshot.body(),
                snapshot.snapshotSha256(),
                typedName,
                "CANDIDATE",
                LocalDateTime.now(),
                null,
                null
        );

        HrDocumentDtos.DocumentResponse stored = documentService.storeGeneratedJson(
                candidateId,
                acceptanceType,
                payload,
                false,
                "CANDIDATE",
                auditMessage + " - version " + snapshot.version()
        );

        auditService.log(
                action,
                "CANDIDATE",
                candidateId.toString(),
                "CANDIDATE",
                auditMessage + ". Version: " + snapshot.version(),
                "{\"snapshotSha256\":\"" + snapshot.snapshotSha256() + "\"}"
        );

        return acceptanceResponse(stored, payload);
    }

    private Optional<HrOnboardingDtos.LegalSnapshotResponse> latestLegalSnapshot(
            UUID candidateId,
            HrDocumentType type
    ) {
        return documentService.latestGeneratedJson(candidateId, type, LegalSnapshotPayload.class)
                .map(x -> legalSnapshotResponse(x.document(), x.payload()));
    }

    private Optional<HrOnboardingDtos.AgreementAcceptanceResponse> currentAcceptance(
            UUID candidateId,
            HrDocumentType type,
            String requiredSnapshotSha
    ) {
        if (requiredSnapshotSha == null) return Optional.empty();
        return documentService.activeGeneratedJson(candidateId, type, AcceptancePayload.class)
                .stream()
                .filter(x -> requiredSnapshotSha.equalsIgnoreCase(x.payload().snapshotSha256()))
                .findFirst()
                .map(x -> acceptanceResponse(x.document(), x.payload()));
    }

    private HrOnboardingDtos.LegalSnapshotResponse legalSnapshotResponse(
            HrDocumentDtos.DocumentResponse document,
            LegalSnapshotPayload payload
    ) {
        return new HrOnboardingDtos.LegalSnapshotResponse(
                document.id(),
                payload.version(),
                payload.title(),
                payload.body(),
                payload.snapshotSha256(),
                payload.publishedBy(),
                payload.publishedAt()
        );
    }

    private HrOnboardingDtos.AgreementAcceptanceResponse acceptanceResponse(
            HrDocumentDtos.DocumentResponse document,
            AcceptancePayload payload
    ) {
        return new HrOnboardingDtos.AgreementAcceptanceResponse(
                document.id(),
                payload.version(),
                payload.title(),
                payload.body(),
                payload.snapshotSha256(),
                payload.typedName(),
                payload.acceptedBy(),
                payload.acceptedAt(),
                payload.verifiedBy(),
                payload.verifiedAt()
        );
    }

    // -------------------------------------------------------------------------
    // Orientation / feedback helpers
    // -------------------------------------------------------------------------

    private HrDocumentService.GeneratedJson<OrientationPayload> ensureOrientationState(UUID candidateId, String actor) {
        Optional<HrDocumentService.GeneratedJson<OrientationPayload>> existing = latestOrientationState(candidateId);
        if (existing.isPresent()) return existing.get();

        OrientationPayload payload = new OrientationPayload(
                "1.0",
                defaultOrientationTasks(),
                false,
                null,
                null,
                LocalDateTime.now()
        );

        HrDocumentDtos.DocumentResponse stored = documentService.storeGeneratedJson(
                candidateId,
                HrDocumentType.ORIENTATION_STATE,
                payload,
                true,
                actor == null ? "SYSTEM" : actor,
                "Initial employee orientation checklist"
        );

        return new HrDocumentService.GeneratedJson<>(stored, payload);
    }

    private Optional<HrDocumentService.GeneratedJson<OrientationPayload>> latestOrientationState(UUID candidateId) {
        return documentService.latestGeneratedJson(
                candidateId,
                HrDocumentType.ORIENTATION_STATE,
                OrientationPayload.class
        );
    }

    private HrOnboardingDtos.OrientationResponse orientationResponse(UUID candidateId) {
        Optional<HrDocumentService.GeneratedJson<OrientationPayload>> stored = latestOrientationState(candidateId);
        if (stored.isEmpty()) {
            OrientationPayload payload = new OrientationPayload(
                    "1.0",
                    defaultOrientationTasks(),
                    false,
                    null,
                    null,
                    null
            );
            return new HrOnboardingDtos.OrientationResponse(
                    null,
                    null,
                    payload.version(),
                    payload.tasks(),
                    allRequiredOrientationComplete(payload.tasks()),
                    payload.employeeAcknowledged(),
                    payload.employeeAcknowledgedName(),
                    payload.employeeAcknowledgedAt(),
                    payload.updatedAt()
            );
        }
        return orientationResponse(stored.get().document(), stored.get().payload());
    }

    private HrOnboardingDtos.OrientationResponse orientationResponse(
            HrDocumentDtos.DocumentResponse document,
            OrientationPayload payload
    ) {
        return new HrOnboardingDtos.OrientationResponse(
                document.id(),
                document.sha256(),
                payload.version(),
                payload.tasks(),
                allRequiredOrientationComplete(payload.tasks()),
                payload.employeeAcknowledged(),
                payload.employeeAcknowledgedName(),
                payload.employeeAcknowledgedAt(),
                payload.updatedAt()
        );
    }

    private boolean allRequiredOrientationComplete(List<HrOnboardingDtos.OrientationTask> tasks) {
        return tasks != null && tasks.stream()
                .filter(HrOnboardingDtos.OrientationTask::required)
                .allMatch(HrOnboardingDtos.OrientationTask::completed);
    }

    private List<HrOnboardingDtos.OrientationTask> defaultOrientationTasks() {
        List<HrOnboardingDtos.OrientationTask> tasks = new ArrayList<>();

        addOrientation(tasks, "HR01", "HR", "About the company");
        addOrientation(tasks, "HR02", "HR", "Vision, Mission and Value system");
        addOrientation(tasks, "HR03", "HR", "Organogram");
        addOrientation(tasks, "HR04", "HR", "General appearance / Dress code");
        addOrientation(tasks, "HR05", "HR", "Office hours");
        addOrientation(tasks, "HR06", "HR", "Attendance and punctuality");
        addOrientation(tasks, "HR07", "HR", "Leave procedure");
        addOrientation(tasks, "HR08", "HR", "Holidays");
        addOrientation(tasks, "HR09", "HR", "Internet and telephone usage");
        addOrientation(tasks, "HR10", "HR", "Procedure to request stationery");
        addOrientation(tasks, "HR11", "HR", "Request and issue of company property");
        addOrientation(tasks, "HR12", "HR", "Reimbursement of official expenses");
        addOrientation(tasks, "HR13", "HR", "Bank account opening");
        addOrientation(tasks, "HR14", "HR", "Probationary period");
        addOrientation(tasks, "HR15", "HR", "Salary, promotion and transfer");
        addOrientation(tasks, "HR16", "HR", "Availability of forms and formats");
        addOrientation(tasks, "HR17", "HR", "Performance management system");
        addOrientation(tasks, "HR18", "HR", "Training and development policy");
        addOrientation(tasks, "HR19", "HR", "Termination and resignation notice");
        addOrientation(tasks, "HR20", "HR", "Local travel policy");
        addOrientation(tasks, "HR21", "HR", "Outstation travel policy");
        addOrientation(tasks, "HR22", "HR", "Leave policy");
        addOrientation(tasks, "HR23", "HR", "Notice boards");
        addOrientation(tasks, "HR24", "HR", "Canteen / Cafeteria");
        addOrientation(tasks, "HR25", "HR", "Drinking water");
        addOrientation(tasks, "HR26", "HR", "Parking facilities");
        addOrientation(tasks, "HR27", "HR", "Security / Search / Alarm system");
        addOrientation(tasks, "HR28", "HR", "Washroom");
        addOrientation(tasks, "HR29", "HR", "Courier and mail system");
        addOrientation(tasks, "HR30", "HR", "Print / Scan / Copy / Fax system");
        addOrientation(tasks, "HR31", "HR", "Introduction to fellow employees");
        addOrientation(tasks, "HR32", "HR", "Workstation");

        addOrientation(tasks, "DEPT01", "DEPARTMENT", "Explanation of the work of the department");
        addOrientation(tasks, "DEPT02", "DEPARTMENT", "Inter-departmental communication");
        addOrientation(tasks, "DEPT03", "DEPARTMENT", "Departmental reporting structure");
        addOrientation(tasks, "DEPT04", "DEPARTMENT", "Key duties and responsibilities");
        addOrientation(tasks, "DEPT05", "DEPARTMENT", "Performance expectation");

        addOrientation(tasks, "VISIT01", "VISIT", "Manufacturing area visit");
        addOrientation(tasks, "VISIT02", "VISIT", "Office / Factory visit");
        addOrientation(tasks, "VISIT03", "VISIT", "Showroom visit");
        addOrientation(tasks, "VISIT04", "VISIT", "Other relevant workplace visit");

        return List.copyOf(tasks);
    }

    private void addOrientation(
            List<HrOnboardingDtos.OrientationTask> target,
            String code,
            String section,
            String label
    ) {
        target.add(new HrOnboardingDtos.OrientationTask(
                code,
                section,
                label,
                true,
                false,
                null,
                null,
                null,
                null,
                null
        ));
    }

    private Optional<HrOnboardingDtos.FeedbackSubmissionResponse> latestFeedback(UUID candidateId) {
        return documentService.latestGeneratedJson(
                        candidateId,
                        HrDocumentType.INDUCTION_FEEDBACK,
                        FeedbackPayload.class
                )
                .map(x -> feedbackResponse(x.document(), x.payload()));
    }

    private HrOnboardingDtos.FeedbackSubmissionResponse feedbackResponse(
            HrDocumentDtos.DocumentResponse document,
            FeedbackPayload payload
    ) {
        return new HrOnboardingDtos.FeedbackSubmissionResponse(
                document.id(),
                payload.answers(),
                payload.submittedBy(),
                payload.submittedAt()
        );
    }

    // -------------------------------------------------------------------------
    // Completion helpers
    // -------------------------------------------------------------------------

    private HrOnboardingDtos.CompletionResponse completionResponse(
            HrOnboardingCase onboarding,
            HrCandidate candidate
    ) {
        UUID candidateId = candidate.getId();
        boolean documents = requiredIdentityDocumentsComplete(candidate);

        boolean joining = joiningReportRepository.findByOnboardingCaseId(onboarding.getId())
                .map(HrJoiningReport::isEmployeeAcknowledged)
                .orElse(false);

        Optional<HrOnboardingDtos.LegalSnapshotResponse> policy =
                latestLegalSnapshot(candidateId, HrDocumentType.ONBOARDING_POLICY_SNAPSHOT);
        boolean policyAck = policy.isPresent()
                && currentAcceptance(
                        candidateId,
                        HrDocumentType.ONBOARDING_POLICY_ACKNOWLEDGEMENT,
                        policy.get().snapshotSha256()
                ).isPresent();

        boolean orientation = documentService.hasActive(candidateId, HrDocumentType.ORIENTATION_RECORD);
        boolean feedback = documentService.hasActive(candidateId, HrDocumentType.INDUCTION_FEEDBACK);

        Optional<HrOnboardingDtos.LegalSnapshotResponse> nda =
                latestLegalSnapshot(candidateId, HrDocumentType.NDA_SNAPSHOT);
        boolean ndaAccepted = nda.isPresent()
                && currentAcceptance(candidateId, HrDocumentType.NDA_ACCEPTANCE, nda.get().snapshotSha256()).isPresent();
        boolean ndaVerified = nda.isPresent()
                && currentAcceptance(candidateId, HrDocumentType.NDA_VERIFICATION, nda.get().snapshotSha256()).isPresent();

        Optional<HrOnboardingDtos.LegalSnapshotResponse> declaration =
                latestLegalSnapshot(candidateId, HrDocumentType.EMPLOYMENT_DECLARATION_SNAPSHOT);
        boolean declarationAccepted = declaration.isPresent()
                && currentAcceptance(
                        candidateId,
                        HrDocumentType.EMPLOYMENT_DECLARATION_ACCEPTANCE,
                        declaration.get().snapshotSha256()
                ).isPresent();

        List<String> pending = new ArrayList<>();
        if (!documents) pending.add("Required identity documents");
        if (!joining) pending.add("Joining report acknowledgement");
        if (!policyAck) pending.add("Current policy acknowledgement");
        if (!orientation) pending.add("Completed orientation acknowledgement");
        if (!feedback) pending.add("Induction feedback");
        if (!ndaAccepted) pending.add("Current NDA acceptance");
        if (!ndaVerified) pending.add("NDA HR verification");
        if (!declarationAccepted) pending.add("Current employment declaration acceptance");

        int total = 8;
        int completed = total - pending.size();
        int percent = (int) Math.round((completed * 100.0) / total);
        boolean complete = pending.isEmpty()
                && onboarding.getStatus() != HrOnboardingStatus.CANCELLED;

        return new HrOnboardingDtos.CompletionResponse(
                onboarding.getId(),
                candidateId,
                onboarding.getStatus(),
                complete,
                completed,
                total,
                percent,
                documents,
                joining,
                policyAck,
                orientation,
                feedback,
                ndaAccepted,
                ndaVerified,
                declarationAccepted,
                List.copyOf(pending)
        );
    }

    private boolean requiredIdentityDocumentsComplete(HrCandidate candidate) {
        HrDocumentDtos.DocumentCompletenessResponse docs = documentService.completenessSystem(candidate.getId());
        boolean base = docs.hasPhoto() && docs.hasAadhaar();
        if (candidate.getApplicationType() == HrApplicationType.MANAGERIAL_ADMINISTRATIVE) {
            return base && docs.hasPan();
        }
        return base;
    }

    // -------------------------------------------------------------------------
    // Entity / DTO mapping helpers
    // -------------------------------------------------------------------------

    private HrOnboardingDtos.OnboardingSummaryResponse toSummary(HrOnboardingCase o) {
        HrCandidate candidate = requireCandidate(o.getCandidateId());
        return new HrOnboardingDtos.OnboardingSummaryResponse(
                o.getId(),
                o.getCandidateId(),
                candidate.getCandidateNumber(),
                candidate.getFullName(),
                o.getStatus(),
                o.getJoiningDate(),
                o.getDepartment(),
                o.getDesignation(),
                o.getLocation(),
                o.getReportingManager(),
                o.getEmployeeId(),
                o.getCreatedAt(),
                o.getUpdatedAt(),
                o.getRowVersion()
        );
    }

    private HrOnboardingDtos.OnboardingDetailResponse toDetail(HrOnboardingCase o, HrCandidate candidate) {
        HrDocumentDtos.DocumentCompletenessResponse completeness = documentService.completeness(candidate.getId());

        return new HrOnboardingDtos.OnboardingDetailResponse(
                o.getId(),
                o.getCandidateId(),
                candidate.getCandidateNumber(),
                candidate.getFullName(),
                o.getStatus(),
                o.getJoiningDate(),
                o.getDepartment(),
                o.getDesignation(),
                o.getLocation(),
                o.getReportingManager(),
                o.getAppointedBy(),
                o.getRemarks(),
                o.getEmployeeId(),
                o.getCreatedAt(),
                o.getUpdatedAt(),
                o.getRowVersion(),
                completeness
        );
    }

    private HrEmployeeDtos.EmployeeDetailResponse toEmployeeDetail(HrEmployee e) {
        return new HrEmployeeDtos.EmployeeDetailResponse(
                e.getId(),
                e.getCandidateId(),
                e.getEmployeeCode(),
                e.getStatus(),
                e.getFullName(),
                e.getFatherOrHusbandName(),
                e.getDateOfBirth(),
                e.getEmail(),
                e.getMobileNo(),
                e.getPresentAddress(),
                e.getPermanentAddress(),
                e.getDepartment(),
                e.getDesignation(),
                e.getLocation(),
                e.getReportingManager(),
                e.getAppointedBy(),
                e.getDateOfJoining(),
                e.getFlowSuiteUserId(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getRowVersion()
        );
    }

    private HrOnboardingDtos.JoiningReportResponse toJoiningReport(HrJoiningReport r) {
        return new HrOnboardingDtos.JoiningReportResponse(
                r.getId(),
                r.getOnboardingCaseId(),
                r.getEmployeeId(),
                r.getCandidateId(),
                r.getEmployeeCode(),
                r.getEmployeeName(),
                r.getFatherName(),
                r.getDesignation(),
                r.getDepartment(),
                r.getJoiningDate(),
                r.isEmployeeAcknowledged(),
                r.getEmployeeAcknowledgedAt(),
                r.getConfirmedBy(),
                r.getConfirmedAt()
        );
    }

    private HrCandidate requireCandidate(UUID id) {
        if (id == null) throw HrFlowException.badRequest("Candidate id is required.");
        HrCandidate candidate = entityManager.find(HrCandidate.class, id);
        if (candidate == null) throw HrFlowException.notFound("Candidate not found: " + id);
        return candidate;
    }

    private HrOnboardingCase requireOnboarding(UUID id) {
        if (id == null) throw HrFlowException.badRequest("Onboarding case id is required.");
        HrOnboardingCase onboarding = entityManager.find(HrOnboardingCase.class, id);
        if (onboarding == null) throw HrFlowException.notFound("Onboarding case not found: " + id);
        return onboarding;
    }

    private HrOnboardingCase requirePortalOnboarding(HrCandidate candidate) {
        if (candidate == null || candidate.getId() == null) {
            throw HrFlowException.notFound("Candidate was not found.");
        }
        HrOnboardingCase onboarding = onboardingRepository.findByCandidateId(candidate.getId())
                .orElseThrow(() -> HrFlowException.notFound("Onboarding case has not been created yet."));
        if (onboarding.getStatus() == HrOnboardingStatus.CANCELLED) {
            throw HrFlowException.forbidden("This onboarding case has been cancelled.");
        }
        return onboarding;
    }

    private void requireWorkflowOpen(HrOnboardingCase onboarding) {
        if (onboarding.getStatus() == HrOnboardingStatus.CANCELLED) {
            throw HrFlowException.conflict("This onboarding case is cancelled.");
        }
        if (onboarding.getStatus() == HrOnboardingStatus.ONBOARDING_COMPLETE) {
            throw HrFlowException.conflict("This onboarding case has already been completed and frozen.");
        }
    }

    private void assertRowVersion(HrOnboardingCase o, Long requestVersion) {
        if (requestVersion != null && requestVersion.longValue() != o.getRowVersion()) {
            throw HrFlowException.conflict(
                    "This onboarding case changed after it was opened. Refresh and try again."
            );
        }
    }

    private void requireEmploymentFields(HrOnboardingCase o) {
        o.setDepartment(required(o.getDepartment(), "Department is required for onboarding."));
        o.setDesignation(required(o.getDesignation(), "Designation is required for onboarding."));
    }

    private boolean isHodOnly() {
        if (accessService.isGlobalAdmin()) return false;
        List<HrAccessRole> roles = accessService.currentRoles();
        boolean hasHrOperationalRole = roles.contains(HrAccessRole.HR_ADMIN)
                || roles.contains(HrAccessRole.HR_HEAD)
                || roles.contains(HrAccessRole.HR_EXECUTIVE);
        return !hasHrOperationalRole && roles.contains(HrAccessRole.HOD);
    }

    private String generateEmployeeCode() {
        String prefix = clean(properties.getEmployeeCodePrefix());
        if (prefix == null) prefix = "AL";
        String random = UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 6)
                .toUpperCase(Locale.ROOT);
        return prefix.toUpperCase(Locale.ROOT) + "-" + LocalDate.now().getYear() + "-" + random;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            String v = clean(value);
            if (v != null) return v;
        }
        return null;
    }

    private String required(String value, String message) {
        String v = clean(value);
        if (v == null) throw HrFlowException.badRequest(message);
        return v;
    }

    private String clean(String value) {
        if (value == null) return null;
        String v = value.trim();
        return v.isEmpty() ? null : v;
    }

    // Stored as encrypted JSON inside the existing hr_candidate_document table.
    private record LegalSnapshotPayload(
            String version,
            String title,
            String body,
            String snapshotSha256,
            String publishedBy,
            LocalDateTime publishedAt
    ) {}

    private record AcceptancePayload(
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

    private record OrientationPayload(
            String version,
            List<HrOnboardingDtos.OrientationTask> tasks,
            boolean employeeAcknowledged,
            String employeeAcknowledgedName,
            LocalDateTime employeeAcknowledgedAt,
            LocalDateTime updatedAt
    ) {}

    private record FeedbackPayload(
            List<HrOnboardingDtos.FeedbackAnswer> answers,
            String submittedBy,
            LocalDateTime submittedAt
    ) {}

    private record CompletionPayload(
            UUID onboardingCaseId,
            UUID candidateId,
            HrOnboardingDtos.CompletionResponse completion,
            String completedBy,
            LocalDateTime completedAt
    ) {}
}
