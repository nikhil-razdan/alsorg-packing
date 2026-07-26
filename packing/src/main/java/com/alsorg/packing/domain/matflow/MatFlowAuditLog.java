package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mat_flow_audit_logs", indexes = {
        @Index(name = "idx_mat_flow_audit_release", columnList = "release_id,changed_at"),

        @Index(name = "idx_mat_flow_audit_entity", columnList = "entity_type,entity_id")
})
public class MatFlowAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "release_id", nullable = false)
    public UUID releaseId;

    @Column(name = "entity_type", nullable = false, length = 100)
    public String entityType;

    @Column(name = "entity_id")
    public UUID entityId;

    @Column(name = "action", nullable = false, length = 150)
    public String action;

    @Column(name = "old_value", length = 4000)
    public String oldValue;

    @Column(name = "new_value", length = 4000)
    public String newValue;

    @Column(name = "changed_by", nullable = false, length = 150)
    public String changedBy;

    @Column(name = "changed_at", nullable = false)
    public LocalDateTime changedAt;

    @PrePersist
    public void prePersist() {
        if (changedAt == null) {
            changedAt = LocalDateTime.now();
        }
    }
}