package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

@Entity
@Table(name = "mf_projects",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_project_plant_code", columnNames = {"plant_code", "project_code"}),
        indexes = {
                @Index(name = "idx_mf_projects_client", columnList = "client_name"),
                @Index(name = "idx_mf_projects_active", columnList = "active"),
                @Index(name = "idx_mf_projects_required", columnList = "required_date")
        })
public class MatFlowProject extends MatFlowBaseEntity {

    /** Existing projectCode is retained; business meaning is PD No. / Project No. */
    @Column(name = "project_code", nullable = false, length = 100)
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

    /** Designer-1 from the upstream/client-facing design team. */
    @Column(name = "designer_1", length = 150)
    private String designer1;

    /** Head of the execution Design Department who delegates Designer-2 tasks. */
    @Column(name = "design_head", length = 150)
    private String designHead;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public String getProjectCode() { return projectCode; }
    public void setProjectCode(String value) { projectCode = cleanUpper(value); }
    public String getProjectName() { return projectName; }
    public void setProjectName(String value) { projectName = clean(value); }
    public String getClientName() { return clientName; }
    public void setClientName(String value) { clientName = clean(value); }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String value) { plantCode = cleanUpper(value); }
    public LocalDate getRequiredDate() { return requiredDate; }
    public void setRequiredDate(LocalDate value) { requiredDate = value; }
    public String getPriority() { return priority; }
    public void setPriority(String value) { String next = cleanUpper(value); priority = next == null ? "NORMAL" : next; }
    public String getProjectManager() { return projectManager; }
    public void setProjectManager(String value) { projectManager = clean(value); }
    public String getDesigner1() { return designer1; }
    public void setDesigner1(String value) { designer1 = clean(value); }
    public String getDesignHead() { return designHead; }
    public void setDesignHead(String value) { designHead = clean(value); }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { remarks = clean(value); }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { active = value; }
}
