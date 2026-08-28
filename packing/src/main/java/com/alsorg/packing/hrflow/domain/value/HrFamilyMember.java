package com.alsorg.packing.hrflow.domain.value;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.time.LocalDate;

@Embeddable
public class HrFamilyMember {

    @Column(name = "family_name", length = 160)
    private String name;

    @Column(name = "family_relation", length = 100)
    private String relation;

    @Column(name = "family_dob")
    private LocalDate dateOfBirth;

    @Column(name = "family_dependent")
    private Boolean dependent;

    public HrFamilyMember() {
    }

    public HrFamilyMember(
            String name,
            String relation,
            LocalDate dateOfBirth,
            Boolean dependent
    ) {
        this.name = name;
        this.relation = relation;
        this.dateOfBirth = dateOfBirth;
        this.dependent = dependent;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public Boolean getDependent() {
        return dependent;
    }

    public void setDependent(Boolean dependent) {
        this.dependent = dependent;
    }
}
