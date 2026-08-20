package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.domain.HrEmployee;
import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrEmployeeRepository;
import com.alsorg.packing.hrflow.security.HrAccessService;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class HrEmployeeService {

    private final HrEmployeeRepository repository;
    private final HrAccessService accessService;
    private final EntityManager entityManager;

    public HrEmployeeService(
            HrEmployeeRepository repository,
            HrAccessService accessService,
            EntityManager entityManager
    ) {
        this.repository = repository;
        this.accessService = accessService;
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
