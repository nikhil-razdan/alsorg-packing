package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mf_stock_ledger", indexes = {
        @Index(name = "idx_mf_ledger_material", columnList = "material_id"),
        @Index(name = "idx_mf_ledger_location", columnList = "location_id"),
        @Index(name = "idx_mf_ledger_reference", columnList = "reference_type, reference_id"),
        @Index(name = "idx_mf_ledger_date", columnList = "action_at")
})
public class MatFlowStockLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    public MatFlowLocation location;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 60)
    public MovementType movementType;

    /**
     * Positive = stock added.
     * Negative = stock removed.
     * Zero = reservation-only movement.
     */
    @Column(name = "quantity_change", nullable = false, precision = 19, scale = 3)
    public BigDecimal quantityChange = BigDecimal.ZERO;

    /**
     * Positive = reservation added.
     * Negative = reservation released.
     */
    @Column(name = "reserved_change", nullable = false, precision = 19, scale = 3)
    public BigDecimal reservedChange = BigDecimal.ZERO;

    @Column(name = "blocked_change", nullable = false, precision = 19, scale = 3)
    public BigDecimal blockedChange = BigDecimal.ZERO;

    @Column(name = "in_transit_change", nullable = false, precision = 19, scale = 3)
    public BigDecimal inTransitChange = BigDecimal.ZERO;

    @Column(name = "on_hand_after", nullable = false, precision = 19, scale = 3)
    public BigDecimal onHandAfter = BigDecimal.ZERO;

    @Column(name = "reserved_after", nullable = false, precision = 19, scale = 3)
    public BigDecimal reservedAfter = BigDecimal.ZERO;

    @Column(name = "blocked_after", nullable = false, precision = 19, scale = 3)
    public BigDecimal blockedAfter = BigDecimal.ZERO;

    @Column(name = "in_transit_after", nullable = false, precision = 19, scale = 3)
    public BigDecimal inTransitAfter = BigDecimal.ZERO;

    @Column(name = "reference_type", nullable = false, length = 100)
    public String referenceType;

    @Column(name = "reference_id")
    public UUID referenceId;

    @Column(name = "reference_number", length = 150)
    public String referenceNumber;

    @Column(name = "project_code", length = 100)
    public String projectCode;

    @Column(name = "drawing_no", length = 150)
    public String drawingNo;

    @Column(name = "batch_no", length = 150)
    public String batchNo;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;

    @Column(name = "actor", nullable = false, length = 150)
    public String actor;

    @Column(name = "action_at", nullable = false)
    public LocalDateTime actionAt;

    @PrePersist
    public void prePersist() {
        if (actionAt == null) {
            actionAt = LocalDateTime.now();
        }
    }
}