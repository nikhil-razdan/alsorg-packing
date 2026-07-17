package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "ven_flow_material_movements",
        indexes = {
                @Index(
                        name = "idx_vf_movement_entry_date",
                        columnList = "entry_id,created_at"
                ),
                @Index(
                        name = "idx_vf_movement_allocation",
                        columnList = "allocation_id"
                )
        }
)
public class VenFlowMaterialMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "entry_id", nullable = false)
    public UUID entryId;

    @Column(name = "allocation_id")
    public UUID allocationId;

    @Column(name = "movement_type", nullable = false)
    public String movementType;

    @Column(precision = 12, scale = 3)
    public BigDecimal quantity;

    @Column(name = "reference_no")
    public String referenceNo;

    @Column(length = 2000)
    public String description;

    @Column(length = 2000)
    public String remarks;

    @Column(name = "performed_by", nullable = false)
    public String performedBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}