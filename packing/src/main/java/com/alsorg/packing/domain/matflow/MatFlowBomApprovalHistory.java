package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.config.TimeZoneConfig;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mf_bom_approval_history", indexes = {
        @Index(name = "idx_mf_bom_history_bom", columnList = "bom_id"),
        @Index(name = "idx_mf_bom_history_group", columnList = "revision_group_id"),
        @Index(name = "idx_mf_bom_history_date", columnList = "action_at")
})
public class MatFlowBomApprovalHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "bom_id", nullable = false)
    private UUID bomId;

    @Column(name = "revision_group_id", nullable = false)
    private UUID revisionGroupId;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 50)
    private MatFlowApprovalAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 40)
    private MatFlowBomStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", length = 40)
    private MatFlowBomStatus toStatus;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "action_by", nullable = false, length = 150)
    private String actionBy;

    @Column(name = "action_at", nullable = false)
    private LocalDateTime actionAt;


    @PrePersist
    private void initialiseActionAt() {
        if (actionAt == null) {
            actionAt = LocalDateTime.now(TimeZoneConfig.APP_ZONE);
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getBomId() {
        return bomId;
    }

    public void setBomId(UUID bomId) {
        this.bomId = bomId;
    }

    public UUID getRevisionGroupId() {
        return revisionGroupId;
    }

    public void setRevisionGroupId(
            UUID revisionGroupId) {
        this.revisionGroupId = revisionGroupId;
    }

    public Integer getRevisionNo() {
        return revisionNo;
    }

    public void setRevisionNo(
            Integer revisionNo) {
        this.revisionNo = revisionNo;
    }

    public MatFlowApprovalAction getAction() {
        return action;
    }

    public void setAction(
            MatFlowApprovalAction action) {
        this.action = action;
    }

    public MatFlowBomStatus getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(
            MatFlowBomStatus fromStatus) {
        this.fromStatus = fromStatus;
    }

    public MatFlowBomStatus getToStatus() {
        return toStatus;
    }

    public void setToStatus(
            MatFlowBomStatus toStatus) {
        this.toStatus = toStatus;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = clean(remarks);
    }

    public String getActionBy() {
        return actionBy;
    }

    public void setActionBy(String actionBy) {
        this.actionBy = clean(actionBy);
    }

    public LocalDateTime getActionAt() {
        return actionAt;
    }

    public void setActionAt(
            LocalDateTime actionAt) {
        this.actionAt = actionAt;
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();

        return normalized.isBlank()
                ? null
                : normalized;
    }
}