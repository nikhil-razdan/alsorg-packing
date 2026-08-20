package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.HrEmployeeStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public final class HrEmployeeDtos {

    private HrEmployeeDtos() {}

    public record EmployeeSummaryResponse(
            UUID id,
            UUID candidateId,
            String employeeCode,
            HrEmployeeStatus status,
            String fullName,
            String department,
            String designation,
            String location,
            LocalDate dateOfJoining,
            String mobileNo,
            LocalDateTime createdAt,
            long rowVersion
    ) {}

    public record EmployeeDetailResponse(
            UUID id,
            UUID candidateId,
            String employeeCode,
            HrEmployeeStatus status,
            String fullName,
            String fatherOrHusbandName,
            LocalDate dateOfBirth,
            String email,
            String mobileNo,
            String presentAddress,
            String permanentAddress,
            String department,
            String designation,
            String location,
            String reportingManager,
            String appointedBy,
            LocalDate dateOfJoining,
            UUID flowSuiteUserId,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            long rowVersion
    ) {}
}
