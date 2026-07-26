package com.alsorg.packing.domain.bomflow;

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
@Table(
        name = "bom_flow_audit_logs",
        indexes = {
                @Index(
                        name = "idx_bom_flow_audit_bom",
                        columnList = "bom_id,changed_at"),

                @Index(
                        name = "idx_bom_flow_audit_revision",
                        columnList = "revision_id"),

                @Index(
                        name = "idx_bom_flow_audit_item",
                        columnList = "item_id")
        })
public class BomFlowAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "bom_id",
            nullable = false)
    public UUID bomId;

    @Column(name = "revision_id")
    public UUID revisionId;

    @Column(name = "item_id")
    public UUID itemId;

    @Column(
            name = "action",
            nullable = false,
            length = 150)
    public String action;

    @Column(
            name = "old_value",
            length = 4000)
    public String oldValue;

    @Column(
            name = "new_value",
            length = 4000)
    public String newValue;

    @Column(
            name = "changed_by",
            nullable = false,
            length = 150)
    public String changedBy;

    @Column(
            name = "changed_at",
            nullable = false)
    public LocalDateTime changedAt;

    @PrePersist
    public void prePersist() {
        if (changedAt == null) {
            changedAt = LocalDateTime.now();
        }
    }
}