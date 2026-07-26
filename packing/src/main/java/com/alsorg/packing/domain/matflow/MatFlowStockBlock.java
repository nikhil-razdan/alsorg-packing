package com.alsorg.packing.domain.matflow;

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
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "mat_flow_stock_blocks",
        indexes = {
                @Index(
                        name = "idx_mfsb_release",
                        columnList = "release_id"
                ),
                @Index(
                        name = "idx_mfsb_requisition",
                        columnList = "requisition_id"
                ),
                @Index(
                        name = "idx_mfsb_requisition_line",
                        columnList = "requisition_line_id"
                ),
                @Index(
                        name = "idx_mfsb_matflow_line",
                        columnList = "mat_flow_line_id"
                ),
                @Index(
                        name = "idx_mfsb_inventory_item",
                        columnList = "inventory_item_id"
                ),
                @Index(
                        name = "idx_mfsb_status",
                        columnList = "status"
                )
        }
)
public class MatFlowStockBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "release_id",
            nullable = false
    )
    public UUID releaseId;

    @Column(
            name = "requisition_id",
            nullable = false
    )
    public UUID requisitionId;

    @Column(
            name = "requisition_line_id",
            nullable = false
    )
    public UUID requisitionLineId;

    @Column(
            name = "mat_flow_line_id",
            nullable = false
    )
    public UUID matFlowLineId;

    @Column(
            name = "plant_code",
            nullable = false,
            length = 100
    )
    public String plantCode;

    /*
     * Existing inventory item reference, when available.
     */
    @Column(name = "inventory_item_id")
    public UUID inventoryItemId;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "decision",
            nullable = false,
            length = 50
    )
    public MatFlowStoreDecision decision;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "source_type",
            nullable = false,
            length = 50
    )
    public MatFlowStockSourceType sourceType;

    /*
     * Manual stock register, rack, bin, location, batch or
     * external stock reference.
     */
    @Column(
            name = "source_reference",
            length = 500
    )
    public String sourceReference;

    @Column(
            name = "requested_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal requestedQty =
            BigDecimal.ZERO.setScale(3);

    /*
     * Quantity visible or physically verified during review.
     */
    @Column(
            name = "available_qty_snapshot",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal availableQtySnapshot =
            BigDecimal.ZERO.setScale(3);

    /*
     * Quantity reserved against this requisition line.
     */
    @Column(
            name = "blocked_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal blockedQty =
            BigDecimal.ZERO.setScale(3);

    /*
     * requestedQty - blockedQty.
     */
    @Column(
            name = "shortage_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal shortageQty =
            BigDecimal.ZERO.setScale(3);

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 50
    )
    public MatFlowStockBlockStatus status =
            MatFlowStockBlockStatus.ACTIVE;

    @Column(
            name = "active",
            nullable = false
    )
    public boolean active = true;

    @Column(
            name = "reviewed_by",
            nullable = false,
            length = 255
    )
    public String reviewedBy;

    @Column(
            name = "reviewed_at",
            nullable = false
    )
    public LocalDateTime reviewedAt;

    @Column(
            name = "remarks",
            length = 2000
    )
    public String remarks;

    @Column(
            name = "created_at",
            nullable = false
    )
    public LocalDateTime createdAt;

    @Column(
            name = "updated_by",
            length = 255
    )
    public String updatedBy;

    @Column(
            name = "updated_at",
            nullable = false
    )
    public LocalDateTime updatedAt;

    @Version
    @Column(
            name = "row_version",
            nullable = false
    )
    public Long rowVersion;

    @PrePersist
    public void prePersist() {

        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        if (reviewedAt == null) {
            reviewedAt = now;
        }

        updatedAt = now;

        initializeQuantities();

        if (status == null) {
            status = MatFlowStockBlockStatus.ACTIVE;
        }
    }

    @PreUpdate
    public void preUpdate() {

        updatedAt = LocalDateTime.now();

        initializeQuantities();
    }

    private void initializeQuantities() {

        if (requestedQty == null) {
            requestedQty = BigDecimal.ZERO.setScale(3);
        }

        if (availableQtySnapshot == null) {
            availableQtySnapshot = BigDecimal.ZERO.setScale(3);
        }

        if (blockedQty == null) {
            blockedQty = BigDecimal.ZERO.setScale(3);
        }

        if (shortageQty == null) {
            shortageQty = BigDecimal.ZERO.setScale(3);
        }
    }
}