package com.alsorg.packing.domain.admin;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "admin_packet_rollback_audit")
public class AdminPacketRollbackAudit {

    @Id
    private UUID id;

    @Column(name = "packet_item_id", nullable = false)
    private UUID packetItemId;

    @Column(name = "display_name", length = 500)
    private String displayName;

    @Column(name = "from_state", nullable = false, length = 80)
    private String fromState;

    @Column(name = "to_state", nullable = false, length = 80)
    private String toState;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Column(name = "changed_by", nullable = false, length = 150)
    private String changedBy;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;

    @Lob
    @Column(
            name = "before_snapshot_json",
            nullable = false,
            columnDefinition = "TEXT"
    )
    private String beforeSnapshotJson;

    @Lob
    @Column(
            name = "after_snapshot_json",
            nullable = false,
            columnDefinition = "TEXT"
    )
    private String afterSnapshotJson;

    @Lob
    @Column(
            name = "change_summary_json",
            nullable = false,
            columnDefinition = "TEXT"
    )
    private String changeSummaryJson;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPacketItemId() {
        return packetItemId;
    }

    public void setPacketItemId(UUID packetItemId) {
        this.packetItemId = packetItemId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getFromState() {
        return fromState;
    }

    public void setFromState(String fromState) {
        this.fromState = fromState;
    }

    public String getToState() {
        return toState;
    }

    public void setToState(String toState) {
        this.toState = toState;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(String changedBy) {
        this.changedBy = changedBy;
    }

    public LocalDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(LocalDateTime changedAt) {
        this.changedAt = changedAt;
    }

    public String getBeforeSnapshotJson() {
        return beforeSnapshotJson;
    }

    public void setBeforeSnapshotJson(String beforeSnapshotJson) {
        this.beforeSnapshotJson = beforeSnapshotJson;
    }

    public String getAfterSnapshotJson() {
        return afterSnapshotJson;
    }

    public void setAfterSnapshotJson(String afterSnapshotJson) {
        this.afterSnapshotJson = afterSnapshotJson;
    }

    public String getChangeSummaryJson() {
        return changeSummaryJson;
    }

    public void setChangeSummaryJson(String changeSummaryJson) {
        this.changeSummaryJson = changeSummaryJson;
    }
}