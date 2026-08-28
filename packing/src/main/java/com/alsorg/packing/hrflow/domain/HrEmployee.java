package com.alsorg.packing.hrflow.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "hr_employee",
        indexes = {
                @Index(name = "idx_hr_employee_status", columnList = "status"),
                @Index(name = "idx_hr_employee_status_updated", columnList = "status,updated_at"),
                @Index(name = "idx_hr_employee_updated", columnList = "updated_at"),
                @Index(name = "idx_hr_employee_department", columnList = "department"),
                @Index(name = "idx_hr_employee_name", columnList = "full_name")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_hr_employee_code", columnNames = "employee_code"),
                @UniqueConstraint(name = "uk_hr_employee_candidate", columnNames = "candidate_id")
        }
)
public class HrEmployee {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "employee_code", nullable = false, length = 80)
    private String employeeCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private HrEmployeeStatus status = HrEmployeeStatus.ACTIVE;

    @Column(name = "full_name", nullable = false, length = 180)
    private String fullName;

    @Column(name = "father_or_husband_name", length = 180)
    private String fatherOrHusbandName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "email", length = 220)
    private String email;

    @Column(name = "mobile_no", length = 40)
    private String mobileNo;

    @Column(name = "present_address", length = 1500)
    private String presentAddress;

    @Column(name = "permanent_address", length = 1500)
    private String permanentAddress;

    @Column(name = "department", nullable = false, length = 160)
    private String department;

    @Column(name = "designation", nullable = false, length = 160)
    private String designation;

    @Column(name = "location", length = 220)
    private String location;

    @Column(name = "reporting_manager", length = 180)
    private String reportingManager;

    @Column(name = "appointed_by", length = 180)
    private String appointedBy;

    @Column(name = "date_of_joining", nullable = false)
    private LocalDate dateOfJoining;

    @Column(name = "flowsuite_user_id")
    private UUID flowSuiteUserId;

    @Column(name = "created_by", nullable = false, length = 200)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_by", length = 200)
    private String updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
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

    public HrEmployeeStatus getStatus() {
        return status;
    }

    public void setStatus(HrEmployeeStatus status) {
        this.status = status;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getFatherOrHusbandName() {
        return fatherOrHusbandName;
    }

    public void setFatherOrHusbandName(String fatherOrHusbandName) {
        this.fatherOrHusbandName = fatherOrHusbandName;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMobileNo() {
        return mobileNo;
    }

    public void setMobileNo(String mobileNo) {
        this.mobileNo = mobileNo;
    }

    public String getPresentAddress() {
        return presentAddress;
    }

    public void setPresentAddress(String presentAddress) {
        this.presentAddress = presentAddress;
    }

    public String getPermanentAddress() {
        return permanentAddress;
    }

    public void setPermanentAddress(String permanentAddress) {
        this.permanentAddress = permanentAddress;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getDesignation() {
        return designation;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getReportingManager() {
        return reportingManager;
    }

    public void setReportingManager(String reportingManager) {
        this.reportingManager = reportingManager;
    }

    public String getAppointedBy() {
        return appointedBy;
    }

    public void setAppointedBy(String appointedBy) {
        this.appointedBy = appointedBy;
    }

    public LocalDate getDateOfJoining() {
        return dateOfJoining;
    }

    public void setDateOfJoining(LocalDate dateOfJoining) {
        this.dateOfJoining = dateOfJoining;
    }

    public UUID getFlowSuiteUserId() {
        return flowSuiteUserId;
    }

    public void setFlowSuiteUserId(UUID flowSuiteUserId) {
        this.flowSuiteUserId = flowSuiteUserId;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public long getRowVersion() {
        return rowVersion;
    }
}
