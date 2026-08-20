package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.domain.HrEmployee;
import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrEmployeeRepository;
import com.alsorg.packing.hrflow.security.HrAccessService;
import jakarta.persistence.EntityManager;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
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
        EmployeeFormRequest request = parseFormRequest(formKey);
        String key = request.key();

        if (key.equals("FULL_PERSONNEL_PACK")) {
            String candidateKey = "CANDIDATE_PACK_" + request.style().name();
            HrCandidateService.FormPdf candidate =
                    candidateService.candidateFormPdfSystem(employee.getCandidateId(), candidateKey);
            HrOnboardingService.FormPdf onboarding =
                    onboardingService.employeeFormPdfSystem(employee.getId(), "ONBOARDING_PACK");
            return new FormPdf(
                    safeFilePart(employee.getEmployeeCode()) + "_FULL_PERSONNEL_PACK_"
                            + request.style().name() + ".pdf",
                    merge(candidate.bytes(), onboarding.bytes())
            );
        }

        if (isCandidateFormKey(key)) {
            HrCandidateService.FormPdf pdf = candidateService.candidateFormPdfSystem(
                    employee.getCandidateId(),
                    key + "_" + request.style().name()
            );
            return new FormPdf(pdf.fileName(), pdf.bytes());
        }

        HrOnboardingService.FormPdf pdf = onboardingService.employeeFormPdfSystem(employee.getId(), key);
        return new FormPdf(pdf.fileName(), pdf.bytes());
    }

    private byte[] merge(byte[] first, byte[] second) {
        try {
            PDFMergerUtility merger = new PDFMergerUtility();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            merger.setDestinationStream(bytes);
            merger.addSource(new ByteArrayInputStream(first));
            merger.addSource(new ByteArrayInputStream(second));
            merger.mergeDocuments(MemoryUsageSetting.setupMainMemoryOnly());
            return bytes.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("HRFLOW could not merge the employee personnel PDF pack.", ex);
        }
    }

    private boolean isCandidateFormKey(String key) {
        return "PERSONAL_DATA".equals(key)
                || "EMPLOYMENT_APPLICATION".equals(key)
                || "CANDIDATE_PACK".equals(key);
    }

    private EmployeeFormRequest parseFormRequest(String value) {
        String raw = value == null ? "" : value.trim().toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        if (raw.isBlank()) throw HrFlowException.badRequest("Form key is required.");

        PdfStyle style = PdfStyle.MODERN;
        for (String suffix : new String[]{"_ORIGINAL", "_CLASSIC", "_LEGACY"}) {
            if (raw.endsWith(suffix)) {
                raw = raw.substring(0, raw.length() - suffix.length());
                style = PdfStyle.ORIGINAL;
                break;
            }
        }
        if (style == PdfStyle.MODERN) {
            for (String suffix : new String[]{"_MODERN", "_UPDATED", "_NEW"}) {
                if (raw.endsWith(suffix)) {
                    raw = raw.substring(0, raw.length() - suffix.length());
                    break;
                }
            }
        }

        String key = switch (raw) {
            case "FULL", "ALL", "PERSONNEL_PACK", "EMPLOYEE_PACK" -> "FULL_PERSONNEL_PACK";
            case "PERSONAL", "PERSONAL_DATA_FORM" -> "PERSONAL_DATA";
            case "APPLICATION", "EMPLOYMENT", "EMPLOYMENT_APPLICATION_FORM" -> "EMPLOYMENT_APPLICATION";
            default -> raw;
        };
        return new EmployeeFormRequest(key, style);
    }

    private enum PdfStyle { ORIGINAL, MODERN }

    private record EmployeeFormRequest(String key, PdfStyle style) {}

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
