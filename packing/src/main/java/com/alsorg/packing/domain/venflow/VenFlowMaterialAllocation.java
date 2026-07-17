package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "ven_flow_material_allocations",
        indexes = {
                @Index(
                        name = "idx_vf_allocation_entry",
                        columnList = "entry_id"
                ),
                @Index(
                        name = "idx_vf_allocation_status",
                        columnList = "status"
                ),
                @Index(
                        name = "idx_vf_allocation_source",
                        columnList = "source_type"
                )
        }
)
public class VenFlowMaterialAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "entry_id", nullable = false)
    public UUID entryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    public VenFlowMaterialSource sourceType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public VenFlowAllocationStatus status;

    @Column(
            name = "planned_qty",
            nullable = false,
            precision = 12,
            scale = 3
    )
    public BigDecimal plannedQty = BigDecimal.ZERO;

    @Column(
            name = "received_qty",
            nullable = false,
            precision = 12,
            scale = 3
    )
    public BigDecimal receivedQty = BigDecimal.ZERO;

    @Column(
            name = "qc_inspected_qty",
            nullable = false,
            precision = 12,
            scale = 3
    )
    public BigDecimal qcInspectedQty = BigDecimal.ZERO;

    @Column(
            name = "qc_accepted_qty",
            nullable = false,
            precision = 12,
            scale = 3
    )
    public BigDecimal qcAcceptedQty = BigDecimal.ZERO;

    @Column(
            name = "qc_rejected_qty",
            nullable = false,
            precision = 12,
            scale = 3
    )
    public BigDecimal qcRejectedQty = BigDecimal.ZERO;

    @Column(
            name = "qc_hold_qty",
            nullable = false,
            precision = 12,
            scale = 3
    )
    public BigDecimal qcHoldQty = BigDecimal.ZERO;

    @Column(
            name = "issued_qty",
            nullable = false,
            precision = 12,
            scale = 3
    )
    public BigDecimal issuedQty = BigDecimal.ZERO;

    @Column(name = "purchase_request_no")
    public String purchaseRequestNo;

    @Column(name = "requisition_date")
    public LocalDate requisitionDate;

    @Column(nullable = false)
    public boolean active = true;

    @Column(name = "status_entered_at", nullable = false)
    public LocalDateTime statusEnteredAt;

    @Column(name = "created_by")
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "updated_by")
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

        if (updatedAt == null) {
            updatedAt = now;
        }

        if (statusEnteredAt == null) {
            statusEnteredAt = now;
        }

        if (plannedQty == null) {
            plannedQty = BigDecimal.ZERO;
        }

        if (receivedQty == null) {
            receivedQty = BigDecimal.ZERO;
        }

        if (qcInspectedQty == null) {
            qcInspectedQty = BigDecimal.ZERO;
        }

        if (qcAcceptedQty == null) {
            qcAcceptedQty = BigDecimal.ZERO;
        }

        if (qcRejectedQty == null) {
            qcRejectedQty = BigDecimal.ZERO;
        }

        if (qcHoldQty == null) {
            qcHoldQty = BigDecimal.ZERO;
        }

        if (issuedQty == null) {
            issuedQty = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}