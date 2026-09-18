package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;

/**
 * Canonical MatFlow PD / Project aggregate.
 *
 * The Project is the business Production File identity. projectCode is the
 * official PD No. when one exists, but it is deliberately optional because a
 * Project can be created, designed and handed off before a PD No. is allotted.
 */
@Entity
@Table(
        name = "mf_projects",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_mf_project_plant_code",
                columnNames = {"plant_code", "project_code"}),
        indexes = {
                @Index(name = "idx_mf_projects_client", columnList = "client_name"),
                @Index(name = "idx_mf_projects_active", columnList = "active"),
                @Index(name = "idx_mf_projects_required", columnList = "required_date")
        })
public class MatFlowProject extends MatFlowBaseEntity {

    /** Official PD No. / Project Code. Optional until allotted. */
    @Column(name = "project_code", length = 100)
    private String projectCode;

    @Column(name = "project_name", nullable = false, length = 250)
    private String projectName;

    @Column(name = "client_name", nullable = false, length = 250)
    private String clientName;

    @Column(name = "plant_code", nullable = false, length = 50)
    private String plantCode;

    @Column(name = "required_date")
    private LocalDate requiredDate;

    @Column(name = "priority", nullable = false, length = 30)
    private String priority = "NORMAL";

    @Column(name = "project_manager", length = 150)
    private String projectManager;

    @Column(name = "designer_1", length = 150)
    private String designer1;

    @Column(name = "design_head", length = 150)
    private String designHead;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public String getProjectCode() { return projectCode; }
    public void setProjectCode(String value) { this.projectCode = cleanUpper(value); }
    public String getProjectName() { return projectName; }
    public void setProjectName(String value) { this.projectName = clean(value); }
    public String getClientName() { return clientName; }
    public void setClientName(String value) { this.clientName = clean(value); }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String value) { this.plantCode = cleanUpper(value); }
    public LocalDate getRequiredDate() { return requiredDate; }
    public void setRequiredDate(LocalDate value) { this.requiredDate = value; }
    public String getPriority() { return priority; }
    public void setPriority(String value) {
        String next = cleanUpper(value);
        this.priority = next == null ? "NORMAL" : next;
    }
    public String getProjectManager() { return projectManager; }
    public void setProjectManager(String value) { this.projectManager = clean(value); }
    public String getDesigner1() { return designer1; }
    public void setDesigner1(String value) { this.designer1 = clean(value); }
    public String getDesignHead() { return designHead; }
    public void setDesignHead(String value) { this.designHead = clean(value); }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { this.remarks = clean(value); }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { this.active = value; }

    private static String clean(String value) {
        if (value == null) return null;
        String next = value.trim();
        return next.isBlank() ? null : next;
    }

    private static String cleanUpper(String value) {
        String next = clean(value);
        return next == null ? null : next.toUpperCase(java.util.Locale.ROOT);
    }
}
