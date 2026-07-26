package com.alsorg.packing.domain.bomflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bom_flow_items",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_bom_flow_item_line",
                        columnNames = {
                                "revision_id",
                                "line_no"
                        })
        },
        indexes = {
                @Index(
                        name = "idx_bom_flow_item_revision",
                        columnList = "revision_id"),

                @Index(
                        name = "idx_bom_flow_item_category",
                        columnList = "category"),

                @Index(
                        name = "idx_bom_flow_item_code",
                        columnList = "item_code"),

                @Index(
                        name = "idx_bom_flow_item_inventory",
                        columnList = "inventory_item_id")
        })
public class BomFlowItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "revision_id",
            nullable = false)
    public UUID revisionId;

    @Column(
            name = "line_no",
            nullable = false)
    public Integer lineNo;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "category",
            nullable = false,
            length = 100)
    public BomFlowMaterialCategory category;

    @Column(
            name = "sub_category",
            length = 150)
    public String subCategory;

    /**
     * Optional link to your existing inventory/material master.
     */
    @Column(
            name = "inventory_item_id")
    public UUID inventoryItemId;

    @Column(
            name = "item_code",
            length = 150)
    public String itemCode;

    @Column(
            name = "item_name",
            nullable = false,
            length = 500)
    public String itemName;

    @Column(
            name = "item_description",
            length = 3000)
    public String itemDescription;

    @Column(
            name = "specification",
            length = 2000)
    public String specification;

    @Column(
            name = "grade",
            length = 255)
    public String grade;

    @Column(
            name = "brand",
            length = 255)
    public String brand;

    @Column(
            name = "finish",
            length = 255)
    public String finish;

    @Column(
            name = "colour",
            length = 255)
    public String colour;

    @Column(
            name = "thickness",
            length = 150)
    public String thickness;

    @Column(
            name = "material_size",
            length = 500)
    public String size;

    @Column(
            name = "length_value",
            precision = 14,
            scale = 3)
    public BigDecimal length;

    @Column(
            name = "width_value",
            precision = 14,
            scale = 3)
    public BigDecimal width;

    @Column(
            name = "height_value",
            precision = 14,
            scale = 3)
    public BigDecimal height;

    /**
     * Quantity before wastage.
     */
    @Column(
            name = "base_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal baseQty =
            BigDecimal.ZERO;

    @Column(
            name = "wastage_percent",
            nullable = false,
            precision = 8,
            scale = 3)
    public BigDecimal wastagePercent =
            BigDecimal.ZERO;

    /**
     * Backend-calculated quantity:
     *
     * baseQty + wastage quantity
     */
    @Column(
            name = "required_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal requiredQty =
            BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "unit",
            nullable = false,
            length = 50)
    public MaterialUnit unit;

    @Column(
            name = "unit_rate",
            nullable = false,
            precision = 16,
            scale = 4)
    public BigDecimal unitRate =
            BigDecimal.ZERO;

    /**
     * requiredQty × unitRate
     */
    @Column(
            name = "material_amount",
            nullable = false,
            precision = 18,
            scale = 2)
    public BigDecimal materialAmount =
            BigDecimal.ZERO;

    @Column(
            name = "processing_amount",
            nullable = false,
            precision = 18,
            scale = 2)
    public BigDecimal processingAmount =
            BigDecimal.ZERO;

    /**
     * materialAmount + processingAmount
     */
    @Column(
            name = "total_amount",
            nullable = false,
            precision = 18,
            scale = 2)
    public BigDecimal totalAmount =
            BigDecimal.ZERO;

    /**
     * False can be used for informational/non-stock BOM lines.
     */
    @Column(
            name = "store_issue_required",
            nullable = false)
    public boolean storeIssueRequired = true;

    @Column(
            name = "active",
            nullable = false)
    public boolean active = true;

    @Column(
            name = "remarks",
            length = 3000)
    public String remarks;

    @Column(
            name = "created_by",
            nullable = false,
            length = 150)
    public String createdBy;

    @Column(
            name = "created_at",
            nullable = false)
    public LocalDateTime createdAt;

    @Column(
            name = "updated_by",
            length = 150)
    public String updatedBy;

    @Column(
            name = "updated_at",
            nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(
            name = "row_version",
            nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        LocalDateTime now =
                LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (baseQty == null) {
            baseQty = BigDecimal.ZERO;
        }

        if (wastagePercent == null) {
            wastagePercent = BigDecimal.ZERO;
        }

        if (requiredQty == null) {
            requiredQty = BigDecimal.ZERO;
        }

        if (unitRate == null) {
            unitRate = BigDecimal.ZERO;
        }

        if (materialAmount == null) {
            materialAmount = BigDecimal.ZERO;
        }

        if (processingAmount == null) {
            processingAmount = BigDecimal.ZERO;
        }

        if (totalAmount == null) {
            totalAmount = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}