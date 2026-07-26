package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.bomflow.BomFlowMaterialCategory;
import com.alsorg.packing.domain.bomflow.MaterialUnit;

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
        name = "mat_flow_lines",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_mat_flow_line_source_item",
                        columnNames = {
                                "release_id",
                                "source_bom_item_id"
                        }),

                @UniqueConstraint(
                        name = "uk_mat_flow_line_source_line",
                        columnNames = {
                                "release_id",
                                "source_line_no"
                        })
        },
        indexes = {
                @Index(
                        name = "idx_mat_flow_line_release",
                        columnList = "release_id"),

                @Index(
                        name = "idx_mat_flow_line_item_code",
                        columnList = "item_code"),

                @Index(
                        name = "idx_mat_flow_line_inventory",
                        columnList = "inventory_item_id"),

                @Index(
                        name = "idx_mat_flow_line_category",
                        columnList = "category"),

                @Index(
                        name = "idx_mat_flow_line_status",
                        columnList = "status")
        })
public class MatFlowLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "release_id",
            nullable = false)
    public UUID releaseId;

    /*
     * Source BOM item identity.
     */
    @Column(
            name = "source_bom_item_id",
            nullable = false)
    public UUID sourceBomItemId;

    @Column(
            name = "source_line_no",
            nullable = false)
    public Integer sourceLineNo;

    /*
     * Immutable material snapshot.
     */
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

    /*
     * BOM quantity snapshot.
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

    /*
     * Cost snapshot.
     */
    @Column(
            name = "unit_rate",
            nullable = false,
            precision = 16,
            scale = 4)
    public BigDecimal unitRate =
            BigDecimal.ZERO;

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

    @Column(
            name = "total_amount",
            nullable = false,
            precision = 18,
            scale = 2)
    public BigDecimal totalAmount =
            BigDecimal.ZERO;

    @Column(
            name = "store_issue_required",
            nullable = false)
    public boolean storeIssueRequired = true;

    /*
     * MatFlow transactional aggregates.
     */
    @Column(
            name = "requisitioned_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal requisitionedQty =
            BigDecimal.ZERO;

    @Column(
            name = "blocked_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal blockedQty =
            BigDecimal.ZERO;

    @Column(
            name = "shortage_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal shortageQty =
            BigDecimal.ZERO;

    @Column(
            name = "indented_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal indentedQty =
            BigDecimal.ZERO;

    @Column(
            name = "ordered_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal orderedQty =
            BigDecimal.ZERO;

    @Column(
            name = "received_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal receivedQty =
            BigDecimal.ZERO;

    @Column(
            name = "accepted_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal acceptedQty =
            BigDecimal.ZERO;

    @Column(
            name = "rejected_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal rejectedQty =
            BigDecimal.ZERO;

    @Column(
            name = "hold_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal holdQty =
            BigDecimal.ZERO;

    @Column(
            name = "issued_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal issuedQty =
            BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 100)
    public MatFlowLineStatus status =
            MatFlowLineStatus.NOT_REQUISITIONED;

    @Column(
            name = "active",
            nullable = false)
    public boolean active = true;

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

        if (status == null) {
            status =
                    MatFlowLineStatus.NOT_REQUISITIONED;
        }

        initializeQuantities();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();

        initializeQuantities();
    }

    private void initializeQuantities() {
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

        if (requisitionedQty == null) {
            requisitionedQty = BigDecimal.ZERO;
        }

        if (blockedQty == null) {
            blockedQty = BigDecimal.ZERO;
        }

        if (shortageQty == null) {
            shortageQty = BigDecimal.ZERO;
        }

        if (indentedQty == null) {
            indentedQty = BigDecimal.ZERO;
        }

        if (orderedQty == null) {
            orderedQty = BigDecimal.ZERO;
        }

        if (receivedQty == null) {
            receivedQty = BigDecimal.ZERO;
        }

        if (acceptedQty == null) {
            acceptedQty = BigDecimal.ZERO;
        }

        if (rejectedQty == null) {
            rejectedQty = BigDecimal.ZERO;
        }

        if (holdQty == null) {
            holdQty = BigDecimal.ZERO;
        }

        if (issuedQty == null) {
            issuedQty = BigDecimal.ZERO;
        }
    }
}