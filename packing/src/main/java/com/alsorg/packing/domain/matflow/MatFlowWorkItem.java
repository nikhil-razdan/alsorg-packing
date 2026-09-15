package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.Criticality;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(name = "mf_work_items",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_work_item_key", columnNames = {"production_file_id", "item_type", "item_key"}),
        indexes = {
                @Index(name = "idx_mf_work_pf", columnList = "production_file_id"),
                @Index(name = "idx_mf_work_type_status", columnList = "item_type, status"),
                @Index(name = "idx_mf_work_owner", columnList = "assigned_to"),
                @Index(name = "idx_mf_work_due", columnList = "due_at")
        })
public class MatFlowWorkItem extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "production_file_id", nullable = false)
    private MatFlowProductionFile productionFile;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 40)
    private WorkItemType itemType;

    @Column(name = "item_key", nullable = false, length = 120)
    private String itemKey;
    @Column(name = "section", length = 150)
    private String section;
    @Column(name = "title", nullable = false, length = 300)
    private String title;
    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "criticality", nullable = false, length = 20)
    private Criticality criticality = Criticality.REQUIRED;

    @Column(name = "blocking", nullable = false)
    private boolean blocking = false;
    @Column(name = "display_order", nullable = false)
    private Integer displayOrder = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private WorkItemStatus status = WorkItemStatus.PENDING;

    @Column(name = "assigned_to", length = 150)
    private String assignedTo;
    @Column(name = "due_at")
    private LocalDateTime dueAt;
    @Column(name = "started_at")
    private LocalDateTime startedAt;
    @Column(name = "revision_context", length = 120)
    private String revisionContext;
    @Column(name = "priority", nullable = false, length = 20)
    private String priority = "NORMAL";

    @Column(name = "response_text", columnDefinition = "text")
    private String responseText;
    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;
    @Column(name = "completion_note", columnDefinition = "text")
    private String completionNote;
    @Column(name = "completed_by", length = 150)
    private String completedBy;
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    @Column(name = "responded_by", length = 150)
    private String respondedBy;
    @Column(name = "responded_at")
    private LocalDateTime respondedAt;
    @Column(name = "closed_by", length = 150)
    private String closedBy;
    @Column(name = "closed_at")
    private LocalDateTime closedAt;
    @Column(name = "read_at")
    private LocalDateTime readAt;

    public MatFlowProductionFile getProductionFile() { return productionFile; }
    public void setProductionFile(MatFlowProductionFile value) { productionFile = value; }
    public WorkItemType getItemType() { return itemType; }
    public void setItemType(WorkItemType value) { itemType = value; }
    public String getItemKey() { return itemKey; }
    public void setItemKey(String value) { itemKey = cleanUpper(value); }
    public String getSection() { return section; }
    public void setSection(String value) { section = clean(value); }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = clean(value); }
    public String getDescription() { return description; }
    public void setDescription(String value) { description = clean(value); }
    public Criticality getCriticality() { return criticality; }
    public void setCriticality(Criticality value) { criticality = value == null ? Criticality.REQUIRED : value; }
    public boolean isBlocking() { return blocking; }
    public void setBlocking(boolean value) { blocking = value; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer value) { displayOrder = value == null ? 0 : value; }
    public WorkItemStatus getStatus() { return status; }
    public void setStatus(WorkItemStatus value) { status = value == null ? WorkItemStatus.PENDING : value; }
    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String value) { assignedTo = clean(value); }
    public LocalDateTime getDueAt() { return dueAt; }
    public void setDueAt(LocalDateTime value) { dueAt = value; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime value) { startedAt = value; }
    public String getRevisionContext() { return revisionContext; }
    public void setRevisionContext(String value) { revisionContext = cleanUpper(value); }
    public String getPriority() { return priority; }
    public void setPriority(String value) { String next = cleanUpper(value); priority = next == null ? "NORMAL" : next; }
    public String getResponseText() { return responseText; }
    public void setResponseText(String value) { responseText = clean(value); }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { remarks = clean(value); }
    public String getCompletionNote() { return completionNote; }
    public void setCompletionNote(String value) { completionNote = clean(value); }
    public String getCompletedBy() { return completedBy; }
    public void setCompletedBy(String value) { completedBy = clean(value); }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime value) { completedAt = value; }
    public String getRespondedBy() { return respondedBy; }
    public void setRespondedBy(String value) { respondedBy = clean(value); }
    public LocalDateTime getRespondedAt() { return respondedAt; }
    public void setRespondedAt(LocalDateTime value) { respondedAt = value; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String value) { closedBy = clean(value); }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime value) { closedAt = value; }
    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime value) { readAt = value; }
}
