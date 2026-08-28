package com.alsorg.packing.domain.audit;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "admin_deletion_audit")
public class AdminDeletionAudit {

    @Id
    private UUID id;

    @Column(name = "target_type", nullable = false, length = 40)
    private String targetType;

    @Column(name = "target_id", nullable = false, length = 100)
    private String targetId;

    @Column(name = "display_name", length = 500)
    private String displayName;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Column(name = "deleted_by", nullable = false, length = 150)
    private String deletedBy;

    @Column(name = "deleted_at", nullable = false)
    private LocalDateTime deletedAt;

    @Column(name = "affected_rows_json", columnDefinition = "text", nullable = false)
    private String affectedRowsJson;

    @Column(name = "snapshot_json", columnDefinition = "text")
    private String snapshotJson;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public String getTargetId() { return targetId; }
    public void setTargetId(String targetId) { this.targetId = targetId; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getDeletedBy() { return deletedBy; }
    public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
    public String getAffectedRowsJson() { return affectedRowsJson; }
    public void setAffectedRowsJson(String affectedRowsJson) { this.affectedRowsJson = affectedRowsJson; }
    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String snapshotJson) { this.snapshotJson = snapshotJson; }
}
