package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * PD-level Design Department work record.
 *
 * This is the Design execution layer for the canonical Project/PD Production File.
 * Products are internal Design subtasks; departmental handoff happens only once for
 * the whole Project / PD.
 */
@Entity
@Table(
        name = "mf_design_project_work",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_mf_design_project_work_project",
                columnNames = "project_id"),
        indexes = {
                @Index(name = "idx_mf_design_project_assignee", columnList = "assigned_junior"),
                @Index(name = "idx_mf_design_project_due", columnList = "due_at"),
                @Index(name = "idx_mf_design_project_enabled", columnList = "workflow_enabled")
        })
public class MatFlowDesignProjectWork extends MatFlowBaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private MatFlowProject project;

    @Column(name = "workflow_enabled", nullable = false)
    private boolean workflowEnabled;

    @Column(name = "assigned_junior", length = 150)
    private String assignedJunior;

    @Column(name = "assigned_by", length = 150)
    private String assignedBy;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "brief", columnDefinition = "text")
    private String brief;

    @Column(name = "checklist_json", nullable = false, columnDefinition = "text")
    private String checklistJson = "[]";

    @Column(name = "checklist_locked", nullable = false)
    private boolean checklistLocked;

    @Column(name = "checklist_locked_by", length = 150)
    private String checklistLockedBy;

    @Column(name = "checklist_locked_at")
    private LocalDateTime checklistLockedAt;

    @Column(name = "product_progress_json", nullable = false, columnDefinition = "text")
    private String productProgressJson = "{}";

    @Column(name = "logs_json", nullable = false, columnDefinition = "text")
    private String logsJson = "[]";

    public MatFlowProject getProject() { return project; }
    public void setProject(MatFlowProject project) { this.project = project; }
    public boolean isWorkflowEnabled() { return workflowEnabled; }
    public void setWorkflowEnabled(boolean workflowEnabled) { this.workflowEnabled = workflowEnabled; }
    public String getAssignedJunior() { return assignedJunior; }
    public void setAssignedJunior(String value) { this.assignedJunior = clean(value); }
    public String getAssignedBy() { return assignedBy; }
    public void setAssignedBy(String value) { this.assignedBy = clean(value); }
    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
    public LocalDateTime getDueAt() { return dueAt; }
    public void setDueAt(LocalDateTime dueAt) { this.dueAt = dueAt; }
    public String getBrief() { return brief; }
    public void setBrief(String value) { this.brief = clean(value); }
    public String getChecklistJson() { return checklistJson; }
    public void setChecklistJson(String value) { this.checklistJson = value == null || value.isBlank() ? "[]" : value; }
    public boolean isChecklistLocked() { return checklistLocked; }
    public void setChecklistLocked(boolean checklistLocked) { this.checklistLocked = checklistLocked; }
    public String getChecklistLockedBy() { return checklistLockedBy; }
    public void setChecklistLockedBy(String value) { this.checklistLockedBy = clean(value); }
    public LocalDateTime getChecklistLockedAt() { return checklistLockedAt; }
    public void setChecklistLockedAt(LocalDateTime checklistLockedAt) { this.checklistLockedAt = checklistLockedAt; }
    public String getProductProgressJson() { return productProgressJson; }
    public void setProductProgressJson(String value) { this.productProgressJson = value == null || value.isBlank() ? "{}" : value; }
    public String getLogsJson() { return logsJson; }
    public void setLogsJson(String value) { this.logsJson = value == null || value.isBlank() ? "[]" : value; }
}
