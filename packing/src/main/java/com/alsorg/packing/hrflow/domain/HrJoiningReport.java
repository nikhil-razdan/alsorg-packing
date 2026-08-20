package com.alsorg.packing.hrflow.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "hr_joining_report",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_joining_report_onboarding", columnNames = "onboarding_case_id"),
                @UniqueConstraint(name = "uk_hr_joining_report_employee", columnNames = "employee_id")
        }
)
public class HrJoiningReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "onboarding_case_id", nullable = false)
    private UUID onboardingCaseId;

    @Column(name = "employee_id", nullable = false)
    private UUID employeeId;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "employee_code", nullable = false, length = 80)
    private String employeeCode;

    @Column(name = "employee_name", nullable = false, length = 180)
    private String employeeName;

    @Column(name = "father_name", length = 180)
    private String fatherName;

    @Column(name = "designation", nullable = false, length = 160)
    private String designation;

    @Column(name = "department", nullable = false, length = 160)
    private String department;

    @Column(name = "joining_date", nullable = false)
    private LocalDate joiningDate;

    @Column(name = "employee_acknowledged", nullable = false)
    private boolean employeeAcknowledged;

    @Column(name = "employee_acknowledged_at")
    private LocalDateTime employeeAcknowledgedAt;

    @Column(name = "confirmed_by", nullable = false, length = 200)
    private String confirmedBy;

    @Column(name = "confirmed_at", nullable = false)
    private LocalDateTime confirmedAt;

    @PrePersist
    void prePersist() {
        if (confirmedAt == null) confirmedAt = LocalDateTime.now();
        if (employeeAcknowledged && employeeAcknowledgedAt == null) {
            employeeAcknowledgedAt = LocalDateTime.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getOnboardingCaseId() {
        return onboardingCaseId;
    }

    public void setOnboardingCaseId(UUID onboardingCaseId) {
        this.onboardingCaseId = onboardingCaseId;
    }

    public UUID getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(UUID employeeId) {
        this.employeeId = employeeId;
    }

    public UUID getCandidateId() {
        return candidateId;
    }

    public void setCandidateId(UUID candidateId) {
        this.candidateId = candidateId;
    }

    public String getEmployeeCode() {
        return employeeCode;
    }

    public void setEmployeeCode(String employeeCode) {
        this.employeeCode = employeeCode;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }

    public String getFatherName() {
        return fatherName;
    }

    public void setFatherName(String fatherName) {
        this.fatherName = fatherName;
    }

    public String getDesignation() {
        return designation;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public LocalDate getJoiningDate() {
        return joiningDate;
    }

    public void setJoiningDate(LocalDate joiningDate) {
        this.joiningDate = joiningDate;
    }

    public boolean isEmployeeAcknowledged() {
        return employeeAcknowledged;
    }

    public void setEmployeeAcknowledged(boolean employeeAcknowledged) {
        this.employeeAcknowledged = employeeAcknowledged;
    }

    public LocalDateTime getEmployeeAcknowledgedAt() {
        return employeeAcknowledgedAt;
    }

    public void setEmployeeAcknowledgedAt(LocalDateTime employeeAcknowledgedAt) {
        this.employeeAcknowledgedAt = employeeAcknowledgedAt;
    }

    public String getConfirmedBy() {
        return confirmedBy;
    }

    public void setConfirmedBy(String confirmedBy) {
        this.confirmedBy = confirmedBy;
    }

    public LocalDateTime getConfirmedAt() {
        return confirmedAt;
    }
}
