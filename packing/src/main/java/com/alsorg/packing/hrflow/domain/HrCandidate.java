package com.alsorg.packing.hrflow.domain;

import com.alsorg.packing.hrflow.domain.value.HrEducation;
import com.alsorg.packing.hrflow.domain.value.HrEmployment;
import com.alsorg.packing.hrflow.domain.value.HrFamilyMember;
import com.alsorg.packing.hrflow.domain.value.HrLanguage;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "hr_candidate",
        indexes = {
                @Index(name = "idx_hr_candidate_stage", columnList = "stage"),
                @Index(name = "idx_hr_candidate_stage_updated", columnList = "stage,updated_at"),
                @Index(name = "idx_hr_candidate_updated", columnList = "updated_at"),
                @Index(name = "idx_hr_candidate_mobile", columnList = "mobile_no"),
                @Index(name = "idx_hr_candidate_name", columnList = "full_name")
        },
        uniqueConstraints = @UniqueConstraint(name = "uk_hr_candidate_number", columnNames = "candidate_number"))
public class HrCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "candidate_number", nullable = false, length = 50)
    private String candidateNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "application_type", nullable = false, length = 50)
    private HrApplicationType applicationType = HrApplicationType.STANDARD;

    @Enumerated(EnumType.STRING)
    @Column(name = "stage", nullable = false, length = 50)
    private HrCandidateStage stage = HrCandidateStage.NEW;

    @Column(name = "full_name", length = 180)
    private String fullName;

    @Column(name = "father_or_husband_name", length = 180)
    private String fatherOrHusbandName;

    @Enumerated(EnumType.STRING)
    @Column(name = "marital_status", length = 30)
    private HrMaritalStatus maritalStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", length = 30)
    private HrGender gender;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "email", length = 220)
    private String email;

    @Column(name = "mobile_no", length = 40)
    private String mobileNo;

    @Column(name = "post_applied_for", length = 180)
    private String postAppliedFor;

    @Column(name = "work_experience_summary", length = 1000)
    private String workExperienceSummary;

    @Column(name = "educational_qualification_summary", length = 1000)
    private String educationalQualificationSummary;

    @Column(name = "previous_alsorg_experience")
    private Boolean previousAlsorgExperience;

    @Column(name = "previous_alsorg_experience_details", length = 1000)
    private String previousAlsorgExperienceDetails;

    @Column(name = "family_member_worked_at_alsorg")
    private Boolean familyMemberWorkedAtAlsorg;

    @Column(name = "family_member_worked_at_alsorg_details", length = 1000)
    private String familyMemberWorkedAtAlsorgDetails;

    @Column(name = "vaccination", length = 160)
    private String vaccination;

    @Column(name = "present_address", length = 1500)
    private String presentAddress;

    @Column(name = "permanent_address", length = 1500)
    private String permanentAddress;

    @Column(name = "aadhaar_no", length = 1000)
    private String aadhaarNo;

    @Column(name = "pan_no", length = 1000)
    private String panNo;

    @Column(name = "nationality", length = 100)
    private String nationality;

    @Column(name = "religion", length = 100)
    private String religion;

    @Column(name = "driving_license_no", length = 1000)
    private String drivingLicenseNo;

    @Column(name = "family_contact_no", length = 40)
    private String familyContactNo;

    @Column(name = "reference_name", length = 180)
    private String referenceName;

    @Column(name = "salary_drawn", precision = 16, scale = 2)
    private BigDecimal salaryDrawn;

    @Column(name = "salary_expected", precision = 16, scale = 2)
    private BigDecimal salaryExpected;

    @Column(name = "salary_approved", precision = 16, scale = 2)
    private BigDecimal salaryApproved;

    @Column(name = "extracurricular_activities", length = 1500)
    private String extracurricularActivities;

    @Column(name = "hobbies", length = 1500)
    private String hobbies;

    @Column(name = "awards_appreciations", length = 1500)
    private String awardsAppreciations;

    @Column(name = "organization_chart_note", length = 3000)
    private String organizationChartNote;

    @Column(name = "declaration_accepted", nullable = false)
    private boolean declarationAccepted;

    @Column(name = "declaration_accepted_at")
    private LocalDateTime declarationAcceptedAt;

    @Column(name = "proposed_joining_date")
    private LocalDate proposedJoiningDate;

    @Column(name = "department", length = 160)
    private String department;

    @Column(name = "designation", length = 160)
    private String designation;

    @Column(name = "appointed_by", length = 180)
    private String appointedBy;

    @Column(name = "hr_owner", length = 180)
    private String hrOwner;

    @Column(name = "last_submitted_at")
    private LocalDateTime lastSubmittedAt;

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

    @ElementCollection
    @CollectionTable(name = "hr_candidate_family", joinColumns = @JoinColumn(name = "candidate_id"))
    @OrderColumn(name = "sort_order")
    private List<HrFamilyMember> familyMembers = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "hr_candidate_education", joinColumns = @JoinColumn(name = "candidate_id"))
    @OrderColumn(name = "sort_order")
    private List<HrEducation> educations = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "hr_candidate_employment", joinColumns = @JoinColumn(name = "candidate_id"))
    @OrderColumn(name = "sort_order")
    private List<HrEmployment> employments = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "hr_candidate_language", joinColumns = @JoinColumn(name = "candidate_id"))
    @OrderColumn(name = "sort_order")
    private List<HrLanguage> languages = new ArrayList<>();

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

    public UUID getId() { return id; }
    public String getCandidateNumber() { return candidateNumber; }
    public void setCandidateNumber(String candidateNumber) { this.candidateNumber = candidateNumber; }
    public HrApplicationType getApplicationType() { return applicationType; }
    public void setApplicationType(HrApplicationType applicationType) { this.applicationType = applicationType; }
    public HrCandidateStage getStage() { return stage; }
    public void setStage(HrCandidateStage stage) { this.stage = stage; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getFatherOrHusbandName() { return fatherOrHusbandName; }
    public void setFatherOrHusbandName(String fatherOrHusbandName) { this.fatherOrHusbandName = fatherOrHusbandName; }
    public HrMaritalStatus getMaritalStatus() { return maritalStatus; }
    public void setMaritalStatus(HrMaritalStatus maritalStatus) { this.maritalStatus = maritalStatus; }
    public HrGender getGender() { return gender; }
    public void setGender(HrGender gender) { this.gender = gender; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getMobileNo() { return mobileNo; }
    public void setMobileNo(String mobileNo) { this.mobileNo = mobileNo; }
    public String getPostAppliedFor() { return postAppliedFor; }
    public void setPostAppliedFor(String postAppliedFor) { this.postAppliedFor = postAppliedFor; }
    public String getWorkExperienceSummary() { return workExperienceSummary; }
    public void setWorkExperienceSummary(String workExperienceSummary) { this.workExperienceSummary = workExperienceSummary; }
    public String getEducationalQualificationSummary() { return educationalQualificationSummary; }
    public void setEducationalQualificationSummary(String educationalQualificationSummary) { this.educationalQualificationSummary = educationalQualificationSummary; }
    public Boolean getPreviousAlsorgExperience() { return previousAlsorgExperience; }
    public void setPreviousAlsorgExperience(Boolean previousAlsorgExperience) { this.previousAlsorgExperience = previousAlsorgExperience; }
    public String getPreviousAlsorgExperienceDetails() { return previousAlsorgExperienceDetails; }
    public void setPreviousAlsorgExperienceDetails(String previousAlsorgExperienceDetails) { this.previousAlsorgExperienceDetails = previousAlsorgExperienceDetails; }
    public Boolean getFamilyMemberWorkedAtAlsorg() { return familyMemberWorkedAtAlsorg; }
    public void setFamilyMemberWorkedAtAlsorg(Boolean familyMemberWorkedAtAlsorg) { this.familyMemberWorkedAtAlsorg = familyMemberWorkedAtAlsorg; }
    public String getFamilyMemberWorkedAtAlsorgDetails() { return familyMemberWorkedAtAlsorgDetails; }
    public void setFamilyMemberWorkedAtAlsorgDetails(String familyMemberWorkedAtAlsorgDetails) { this.familyMemberWorkedAtAlsorgDetails = familyMemberWorkedAtAlsorgDetails; }
    public String getVaccination() { return vaccination; }
    public void setVaccination(String vaccination) { this.vaccination = vaccination; }
    public String getPresentAddress() { return presentAddress; }
    public void setPresentAddress(String presentAddress) { this.presentAddress = presentAddress; }
    public String getPermanentAddress() { return permanentAddress; }
    public void setPermanentAddress(String permanentAddress) { this.permanentAddress = permanentAddress; }
    public String getAadhaarNo() { return aadhaarNo; }
    public void setAadhaarNo(String aadhaarNo) { this.aadhaarNo = aadhaarNo; }
    public String getPanNo() { return panNo; }
    public void setPanNo(String panNo) { this.panNo = panNo; }
    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }
    public String getReligion() { return religion; }
    public void setReligion(String religion) { this.religion = religion; }
    public String getDrivingLicenseNo() { return drivingLicenseNo; }
    public void setDrivingLicenseNo(String drivingLicenseNo) { this.drivingLicenseNo = drivingLicenseNo; }
    public String getFamilyContactNo() { return familyContactNo; }
    public void setFamilyContactNo(String familyContactNo) { this.familyContactNo = familyContactNo; }
    public String getReferenceName() { return referenceName; }
    public void setReferenceName(String referenceName) { this.referenceName = referenceName; }
    public BigDecimal getSalaryDrawn() { return salaryDrawn; }
    public void setSalaryDrawn(BigDecimal salaryDrawn) { this.salaryDrawn = salaryDrawn; }
    public BigDecimal getSalaryExpected() { return salaryExpected; }
    public void setSalaryExpected(BigDecimal salaryExpected) { this.salaryExpected = salaryExpected; }
    public BigDecimal getSalaryApproved() { return salaryApproved; }
    public void setSalaryApproved(BigDecimal salaryApproved) { this.salaryApproved = salaryApproved; }
    public String getExtracurricularActivities() { return extracurricularActivities; }
    public void setExtracurricularActivities(String extracurricularActivities) { this.extracurricularActivities = extracurricularActivities; }
    public String getHobbies() { return hobbies; }
    public void setHobbies(String hobbies) { this.hobbies = hobbies; }
    public String getAwardsAppreciations() { return awardsAppreciations; }
    public void setAwardsAppreciations(String awardsAppreciations) { this.awardsAppreciations = awardsAppreciations; }
    public String getOrganizationChartNote() { return organizationChartNote; }
    public void setOrganizationChartNote(String organizationChartNote) { this.organizationChartNote = organizationChartNote; }
    public boolean isDeclarationAccepted() { return declarationAccepted; }
    public void setDeclarationAccepted(boolean declarationAccepted) { this.declarationAccepted = declarationAccepted; }
    public LocalDateTime getDeclarationAcceptedAt() { return declarationAcceptedAt; }
    public void setDeclarationAcceptedAt(LocalDateTime declarationAcceptedAt) { this.declarationAcceptedAt = declarationAcceptedAt; }
    public LocalDate getProposedJoiningDate() { return proposedJoiningDate; }
    public void setProposedJoiningDate(LocalDate proposedJoiningDate) { this.proposedJoiningDate = proposedJoiningDate; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
    public String getAppointedBy() { return appointedBy; }
    public void setAppointedBy(String appointedBy) { this.appointedBy = appointedBy; }
    public String getHrOwner() { return hrOwner; }
    public void setHrOwner(String hrOwner) { this.hrOwner = hrOwner; }
    public LocalDateTime getLastSubmittedAt() { return lastSubmittedAt; }
    public void setLastSubmittedAt(LocalDateTime lastSubmittedAt) { this.lastSubmittedAt = lastSubmittedAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public long getRowVersion() { return rowVersion; }
    public List<HrFamilyMember> getFamilyMembers() { return familyMembers; }
    public void setFamilyMembers(List<HrFamilyMember> familyMembers) { this.familyMembers = familyMembers == null ? new ArrayList<>() : new ArrayList<>(familyMembers); }
    public List<HrEducation> getEducations() { return educations; }
    public void setEducations(List<HrEducation> educations) { this.educations = educations == null ? new ArrayList<>() : new ArrayList<>(educations); }
    public List<HrEmployment> getEmployments() { return employments; }
    public void setEmployments(List<HrEmployment> employments) { this.employments = employments == null ? new ArrayList<>() : new ArrayList<>(employments); }
    public List<HrLanguage> getLanguages() { return languages; }
    public void setLanguages(List<HrLanguage> languages) { this.languages = languages == null ? new ArrayList<>() : new ArrayList<>(languages); }
}
