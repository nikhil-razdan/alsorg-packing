package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.DesignTaskStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.DesignTaskType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A Design Department execution task attached to exactly one Production File.
 * Multiple Designer-2 members can collaborate on the same task without creating
 * independent project/product records.
 */
@Entity
@Table(name = "mf_design_tasks",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_design_task_no", columnNames = "task_no"),
        indexes = {
                @Index(name = "idx_mf_design_task_pf", columnList = "production_file_id"),
                @Index(name = "idx_mf_design_task_status", columnList = "status"),
                @Index(name = "idx_mf_design_task_due", columnList = "due_at")
        })
public class MatFlowDesignTask extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "production_file_id", nullable = false)
    private MatFlowProductionFile productionFile;

    @Column(name = "task_no", nullable = false, length = 220)
    private String taskNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_type", nullable = false, length = 40)
    private DesignTaskType taskType = DesignTaskType.OTHER;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    /** Designer-1: upstream/client/project designer who supplied the requirement. */
    @Column(name = "designer_1", length = 150)
    private String designer1;

    @Column(name = "assigned_by", length = 150)
    private String assignedBy;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "mf_design_task_assignees", joinColumns = @JoinColumn(name = "design_task_id"))
    @OrderColumn(name = "assignee_order")
    @Column(name = "assignee", nullable = false, length = 150)
    private List<String> assignees = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private DesignTaskStatus status = DesignTaskStatus.NEED_TO_START;

    @Column(name = "priority", nullable = false, length = 20)
    private String priority = "NORMAL";

    @Column(name = "blocking", nullable = false)
    private boolean blocking = true;

    /** Equivalent to Rec. Date in the source tracker. */
    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "completed_by", length = 150)
    private String completedBy;

    @Column(name = "hold_reason", columnDefinition = "text")
    private String holdReason;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    public MatFlowProductionFile getProductionFile() { return productionFile; }
    public void setProductionFile(MatFlowProductionFile value) { productionFile = value; }
    public String getTaskNo() { return taskNo; }
    public void setTaskNo(String value) { taskNo = cleanUpper(value); }
    public DesignTaskType getTaskType() { return taskType; }
    public void setTaskType(DesignTaskType value) { taskType = value == null ? DesignTaskType.OTHER : value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = clean(value); }
    public String getDescription() { return description; }
    public void setDescription(String value) { description = clean(value); }
    public String getDesigner1() { return designer1; }
    public void setDesigner1(String value) { designer1 = clean(value); }
    public String getAssignedBy() { return assignedBy; }
    public void setAssignedBy(String value) { assignedBy = clean(value); }
    public List<String> getAssignees() { return assignees; }
    public void setAssignees(List<String> values) {
        assignees.clear();
        if (values == null) return;
        values.stream().map(this::clean).filter(v -> v != null).distinct().forEach(assignees::add);
    }
    public DesignTaskStatus getStatus() { return status; }
    public void setStatus(DesignTaskStatus value) { status = value == null ? DesignTaskStatus.NEED_TO_START : value; }
    public String getPriority() { return priority; }
    public void setPriority(String value) { String next = cleanUpper(value); priority = next == null ? "NORMAL" : next; }
    public boolean isBlocking() { return blocking; }
    public void setBlocking(boolean value) { blocking = value; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime value) { receivedAt = value; }
    public LocalDateTime getDueAt() { return dueAt; }
    public void setDueAt(LocalDateTime value) { dueAt = value; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime value) { startedAt = value; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime value) { completedAt = value; }
    public String getCompletedBy() { return completedBy; }
    public void setCompletedBy(String value) { completedBy = clean(value); }
    public String getHoldReason() { return holdReason; }
    public void setHoldReason(String value) { holdReason = clean(value); }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { remarks = clean(value); }
}
