package com.alsorg.packing.bomflow.domain;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bomflow_revisions",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_bomflow_product_revision_no",
                        columnNames = {"product_id", "revision_no"})
        },
        indexes = {
                @Index(
                        name = "idx_bomflow_revision_product",
                        columnList = "product_id"),
                @Index(
                        name = "idx_bomflow_revision_status",
                        columnList = "status")
        })
public class BomFlowRevision {

    @Id
    @Column(nullable = false, updatable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "product_id",
            nullable = false,
            foreignKey = @ForeignKey(
                    name = "fk_bomflow_revision_product"))
    public BomFlowProduct product;

    @Column(name = "revision_no", nullable = false)
    public Integer revisionNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    public BomFlowRevisionStatus status = BomFlowRevisionStatus.DRAFT;

    @Column(name = "remarks", length = 2000)
    public String remarks;

    @Column(name = "submitted_by", length = 120)
    public String submittedBy;

    @Column(name = "submitted_at")
    public LocalDateTime submittedAt;

    @Column(name = "verified_by", length = 120)
    public String verifiedBy;

    @Column(name = "verified_at")
    public LocalDateTime verifiedAt;

    @Column(name = "approved_by", length = 120)
    public String approvedBy;

    @Column(name = "approved_at")
    public LocalDateTime approvedAt;

    @Column(name = "returned_by", length = 120)
    public String returnedBy;

    @Column(name = "returned_at")
    public LocalDateTime returnedAt;

    @Column(name = "return_remarks", length = 2000)
    public String returnRemarks;

    @Column(name = "created_by", nullable = false, length = 120)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "updated_by", nullable = false, length = 120)
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    public Long rowVersion;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }

        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        if (updatedAt == null) {
            updatedAt = now;
        }

        if (status == null) {
            status = BomFlowRevisionStatus.DRAFT;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
