package com.alsorg.packing.bomflow.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bom_flow_items",
        indexes = {
                @Index(
                        name = "idx_bom_flow_item_revision",
                        columnList = "revision_id"),
                @Index(
                        name = "idx_bom_flow_item_section",
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
                    name = "fk_bom_flow_item_revision_v2"))
    public BomFlowRevision revision;

    @Column(name = "line_no", nullable = false)
    public Integer lineNo;

    @Column(name = "section_name", nullable = false, length = 120)
    public String section;

    @Column(name = "category", nullable = false, length = 100)
    public String category;

    @Column(name = "item_name", nullable = false, length = 500)
    public String itemName;

    @Column(name = "brand", length = 255)
    public String brand;

    @Column(name = "vendor_name", length = 220)
    public String vendorName;

    @Column(name = "unit", nullable = false, length = 60)
    public String unit;

    @Column(name = "base_qty", nullable = false, precision = 14, scale = 3)
    public BigDecimal baseQty;

    @Column(name = "wastage_percent", nullable = false, precision = 8, scale = 3)
    public BigDecimal wastagePercent;

    @Column(name = "required_qty", nullable = false, precision = 18, scale = 4)
    public BigDecimal requiredQty;

    @Column(name = "unit_rate", nullable = false, precision = 18, scale = 4)
    public BigDecimal rate;

    @Column(name = "material_amount", nullable = false, precision = 18, scale = 2)
    public BigDecimal materialAmount;

    @Column(name = "processing_amount", nullable = false, precision = 18, scale = 2)
    public BigDecimal processingAmount;

    @Column(name = "total_amount", nullable = false, precision = 18, scale = 4)
    public BigDecimal amount;

    @Column(name = "gst_percent", nullable = false, precision = 9, scale = 4)
    public BigDecimal gstPercent;

    @Column(name = "rate_master_id")
    public UUID rateMasterId;

    @Column(name = "rate_applied_by", length = 150)
    public String rateAppliedBy;

    @Column(name = "rate_applied_at")
    public LocalDateTime rateAppliedAt;

    @Column(name = "store_issue_required", nullable = false)
    public Boolean storeIssueRequired;

    @Column(name = "active", nullable = false)
    public Boolean active;

    @Column(name = "remarks", length = 3000)
    public String remarks;

    @Column(name = "created_by", nullable = false, length = 150)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "updated_by", nullable = false, length = 150)
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

        if (baseQty == null) {
            baseQty = BigDecimal.ZERO;
        }

        if (wastagePercent == null) {
            wastagePercent = BigDecimal.ZERO;
        }

        if (requiredQty == null) {
            requiredQty = BigDecimal.ZERO;
        }

        if (rate == null) {
            rate = BigDecimal.ZERO;
        }

        if (materialAmount == null) {
            materialAmount = BigDecimal.ZERO;
        }

        if (processingAmount == null) {
            processingAmount = BigDecimal.ZERO;
        }

        if (amount == null) {
            amount = BigDecimal.ZERO;
        }

        if (gstPercent == null) {
            gstPercent = BigDecimal.ZERO;
        }

        if (storeIssueRequired == null) {
            storeIssueRequired = true;
        }

        if (active == null) {
            active = true;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
