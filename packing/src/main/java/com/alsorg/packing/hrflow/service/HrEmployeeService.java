package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.domain.HrEmployee;
import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrEmployeeRepository;
import com.alsorg.packing.hrflow.security.HrAccessService;
import jakarta.persistence.EntityManager;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

@Service
public class HrEmployeeService {

    private final HrEmployeeRepository repository;
    private final HrAccessService accessService;
    private final HrCandidateService candidateService;
    private final HrOnboardingService onboardingService;
    private final EntityManager entityManager;

    public HrEmployeeService(
            HrEmployeeRepository repository,
            HrAccessService accessService,
            HrCandidateService candidateService,
            HrOnboardingService onboardingService,
            EntityManager entityManager
    ) {
        this.repository = repository;
        this.accessService = accessService;
        this.candidateService = candidateService;
        this.onboardingService = onboardingService;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Page<HrEmployeeDtos.EmployeeSummaryResponse> list(
            String q,
            HrEmployeeStatus status,
            Pageable pageable
    ) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );

        return repository.search(clean(q), status, pageable).map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public HrEmployeeDtos.EmployeeDetailResponse get(UUID id) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );
        return toDetail(requireEmployee(id));
    }

    @Transactional(readOnly = true)
    public FormPdf formPdf(UUID employeeId, String formKey) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.HOD
        );

        HrEmployee employee = requireEmployee(employeeId);
        String key = normalizeFormKey(formKey);

        if (key.equals("FULL_PERSONNEL_PACK")) {
            HrCandidateService.FormPdf candidate =
                    candidateService.candidateFormPdfSystem(employee.getCandidateId(), "CANDIDATE_PACK");
            HrOnboardingService.FormPdf onboarding =
                    onboardingService.employeeFormPdfSystem(employee.getId(), "ONBOARDING_PACK");
            return new FormPdf(
                    safeFilePart(employee.getEmployeeCode()) + "_FULL_PERSONNEL_PACK.pdf",
                    merge(candidate.bytes(), onboarding.bytes())
            );
        }

        if (key.equals("PERSONAL_DATA") || key.equals("EMPLOYMENT_APPLICATION") || key.equals("CANDIDATE_PACK")) {
            HrCandidateService.FormPdf pdf = candidateService.candidateFormPdfSystem(employee.getCandidateId(), key);
            return new FormPdf(pdf.fileName(), pdf.bytes());
        }

        HrOnboardingService.FormPdf pdf = onboardingService.employeeFormPdfSystem(employee.getId(), key);
        return new FormPdf(pdf.fileName(), pdf.bytes());
    }

    private byte[] merge(byte[] first, byte[] second) {
        try (PDDocument output = new PDDocument();
             PDDocument one = PDDocument.load(first);
             PDDocument two = PDDocument.load(second)) {
            for (int i = 0; i < one.getNumberOfPages(); i++) output.importPage(one.getPage(i));
            for (int i = 0; i < two.getNumberOfPages(); i++) output.importPage(two.getPage(i));
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            output.save(bytes);
            return bytes.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not merge the employee personnel PDF pack.", ex);
        }
    }

    private String normalizeFormKey(String value) {
        String key = value == null ? "" : value.trim().toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        if (key.isBlank()) throw HrFlowException.badRequest("Form key is required.");
        return switch (key) {
            case "FULL", "ALL", "PERSONNEL_PACK", "EMPLOYEE_PACK" -> "FULL_PERSONNEL_PACK";
            case "PERSONAL", "PERSONAL_DATA_FORM" -> "PERSONAL_DATA";
            case "APPLICATION", "EMPLOYMENT", "EMPLOYMENT_APPLICATION_FORM" -> "EMPLOYMENT_APPLICATION";
            default -> key;
        };
    }

    private String safeFilePart(String value) {
        String v = value == null ? "" : value.trim().replaceAll("[^A-Za-z0-9._-]+", "_");
        return v.isBlank() ? "Employee" : v;
    }

    public record FormPdf(String fileName, byte[] bytes) {}

    private HrEmployee requireEmployee(UUID id) {
        if (id == null) throw HrFlowException.badRequest("Employee id is required.");
        HrEmployee employee = entityManager.find(HrEmployee.class, id);
        if (employee == null) throw HrFlowException.notFound("Employee not found: " + id);
        return employee;
    }

    private HrEmployeeDtos.EmployeeSummaryResponse toSummary(HrEmployee e) {
        return new HrEmployeeDtos.EmployeeSummaryResponse(
                e.getId(),
                e.getCandidateId(),
                e.getEmployeeCode(),
                e.getStatus(),
                e.getFullName(),
                e.getDepartment(),
                e.getDesignation(),
                e.getLocation(),
                e.getDateOfJoining(),
                e.getMobileNo(),
                e.getCreatedAt(),
                e.getRowVersion()
        );
    }

    private HrEmployeeDtos.EmployeeDetailResponse toDetail(HrEmployee e) {
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

    private String clean(String value) {
        if (value == null) return null;
        String v = value.trim();
        return v.isEmpty() ? null : v;
    }
}
