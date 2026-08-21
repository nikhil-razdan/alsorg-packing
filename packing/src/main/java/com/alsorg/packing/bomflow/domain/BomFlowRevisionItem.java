package com.alsorg.packing.bomflow.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bomflow_revision_items",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_bomflow_revision_line_no",
                        columnNames = {"revision_id", "line_no"})
        },
        indexes = {
                @Index(
                        name = "idx_bomflow_item_revision",
                        columnList = "revision_id"),
                @Index(
                        name = "idx_bomflow_item_section",
                        columnList = "section_name")
        })
public class BomFlowRevisionItem {

    @Id
    @Column(nullable = false, updatable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "revision_id",
            nullable = false,
            foreignKey = @ForeignKey(
                    name = "fk_bomflow_item_revision"))
    public BomFlowRevision revision;

    @Column(name = "line_no", nullable = false)
    public Integer lineNo;

    @Column(name = "section_name", nullable = false, length = 120)
    public String section;

    @Column(name = "category_name", length = 120)
    public String category;

    @Column(name = "item_name", nullable = false, length = 300)
    public String itemName;

    @Column(name = "brand", length = 160)
    public String brand;

    @Column(name = "vendor_name", length = 220)
    public String vendorName;

    @Column(name = "unit", nullable = false, length = 60)
    public String unit;

    @Column(name = "required_qty", nullable = false, precision = 18, scale = 4)
    public BigDecimal requiredQty;

    @Column(name = "rate", nullable = false, precision = 18, scale = 4)
    public BigDecimal rate;

    @Column(name = "amount", nullable = false, precision = 18, scale = 4)
    public BigDecimal amount;

    @Column(name = "gst_percent", nullable = false, precision = 9, scale = 4)
    public BigDecimal gstPercent;

    @Column(name = "remarks", length = 2000)
    public String remarks;

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

        if (requiredQty == null) {
            requiredQty = BigDecimal.ZERO;
        }

        if (rate == null) {
            rate = BigDecimal.ZERO;
        }

        if (amount == null) {
            amount = BigDecimal.ZERO;
        }

        if (gstPercent == null) {
            gstPercent = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
