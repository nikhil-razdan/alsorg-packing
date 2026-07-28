package com.alsorg.packing.domain.matflow;

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
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mat_flow_requisition_lines", indexes = {
        @Index(name = "idx_mfrl_requisition", columnList = "requisition_id"),
        @Index(name = "idx_mfrl_matflow_line", columnList = "mat_flow_line_id"),
        @Index(name = "idx_mfrl_status", columnList = "status")
})
public class MatFlowRequisitionLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "requisition_id", nullable = false)
    public UUID requisitionId;

    @Column(name = "mat_flow_line_id", nullable = false)
    public UUID matFlowLineId;

    @Column(name = "demand_committed", nullable = false)
    private boolean demandCommitted = false;
    /*
     * Snapshot references copied from MatFlowLine.
     */
    @Column(name = "source_bom_item_id")
    public UUID sourceBomItemId;

    @Column(name = "source_line_no", nullable = false)
    public Integer sourceLineNo;

    @Column(name = "item_code", length = 255)
    public String itemCode;

    @Column(name = "item_name", nullable = false, length = 500)
    public String itemName;

    @Column(name = "item_description", length = 2000)
    public String itemDescription;

    @Column(name = "specification", length = 1000)
    public String specification;

    /*
     * Quantity requested by Production in this requisition.
     */
    @Column(name = "requested_qty", nullable = false, precision = 14, scale = 3)
    public BigDecimal requestedQty = BigDecimal.ZERO.setScale(3);

    /*
     * Quantities will be updated during Store review and issue.
     */
    @Column(name = "blocked_qty", nullable = false, precision = 14, scale = 3)
    public BigDecimal blockedQty = BigDecimal.ZERO.setScale(3);

    @Column(name = "shortage_qty", nullable = false, precision = 14, scale = 3)
    public BigDecimal shortageQty = BigDecimal.ZERO.setScale(3);

    @Column(name = "issued_qty", nullable = false, precision = 14, scale = 3)
    public BigDecimal issuedQty = BigDecimal.ZERO.setScale(3);

    @Enumerated(EnumType.STRING)
    @Column(name = "unit", nullable = false, length = 50)
    public MaterialUnit unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public MatFlowLineStatus status = MatFlowLineStatus.REQUISITIONED;

    @Column(name = "production_remarks", length = 2000)
    public String productionRemarks;

    @Column(name = "active", nullable = false)
    public boolean active = true;

    @Column(name = "created_by", nullable = false, length = 255)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "updated_by", length = 255)
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (requestedQty == null) {
            requestedQty = BigDecimal.ZERO.setScale(3);
        }

        if (blockedQty == null) {
            blockedQty = BigDecimal.ZERO.setScale(3);
        }

        if (shortageQty == null) {
            shortageQty = BigDecimal.ZERO.setScale(3);
        }

        if (issuedQty == null) {
            issuedQty = BigDecimal.ZERO.setScale(3);
        }

        if (status == null) {
            status = MatFlowLineStatus.REQUISITIONED;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isDemandCommitted() {
        return demandCommitted;
    }

    public void setDemandCommitted(boolean demandCommitted) {
        this.demandCommitted = demandCommitted;
    }
}