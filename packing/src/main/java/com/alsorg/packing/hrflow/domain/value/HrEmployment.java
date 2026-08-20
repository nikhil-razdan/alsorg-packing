package com.alsorg.packing.hrflow.domain.value;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;
import java.time.LocalDate;

@Embeddable
public class HrEmployment {

    @Column(name = "employment_company_name", length = 220)
    private String companyName;

    @Column(name = "employment_designation", length = 160)
    private String designation;

    @Column(name = "employment_from_date")
    private LocalDate fromDate;

    @Column(name = "employment_to_date")
    private LocalDate toDate;

    @Column(name = "employment_hr_name", length = 160)
    private String hrName;

    @Column(name = "employment_hr_contact", length = 80)
    private String hrContact;

    @Column(name = "employment_last_salary", precision = 16, scale = 2)
    private BigDecimal lastSalary;

    @Column(name = "employment_reason_for_leaving", length = 600)
    private String reasonForLeaving;

    public HrEmployment() {
    }

    public HrEmployment(String companyName, String designation, LocalDate fromDate, LocalDate toDate,
                        String hrName, String hrContact, BigDecimal lastSalary, String reasonForLeaving) {
        this.companyName = companyName;
        this.designation = designation;
        this.fromDate = fromDate;
        this.toDate = toDate;
        this.hrName = hrName;
        this.hrContact = hrContact;
        this.lastSalary = lastSalary;
        this.reasonForLeaving = reasonForLeaving;
    }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
    public LocalDate getFromDate() { return fromDate; }
    public void setFromDate(LocalDate fromDate) { this.fromDate = fromDate; }
    public LocalDate getToDate() { return toDate; }
    public void setToDate(LocalDate toDate) { this.toDate = toDate; }
    public String getHrName() { return hrName; }
    public void setHrName(String hrName) { this.hrName = hrName; }
    public String getHrContact() { return hrContact; }
    public void setHrContact(String hrContact) { this.hrContact = hrContact; }
    public BigDecimal getLastSalary() { return lastSalary; }
    public void setLastSalary(BigDecimal lastSalary) { this.lastSalary = lastSalary; }
    public String getReasonForLeaving() { return reasonForLeaving; }
    public void setReasonForLeaving(String reasonForLeaving) { this.reasonForLeaving = reasonForLeaving; }
}
