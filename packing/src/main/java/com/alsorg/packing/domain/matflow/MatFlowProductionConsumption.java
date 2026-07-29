package com.alsorg.packing.domain.matflow;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "mf_production_consumptions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_consumption_number", columnNames = "consumption_number")
}, indexes = {
        @Index(name = "idx_mf_consumption_requisition", columnList = "requisition_id"),
        @Index(name = "idx_mf_consumption_location", columnList = "production_location_id")
})
public class MatFlowProductionConsumption
        extends MatFlowBaseEntity {

    @Column(name = "consumption_number", nullable = false, length = 150)
    public String consumptionNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_id", nullable = false)
    public MatFlowMaterialRequisition requisition;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "production_location_id", nullable = false)
    public MatFlowLocation productionLocation;

    @Column(name = "consumed_by", nullable = false, length = 150)
    public String consumedBy;

    @Column(name = "consumed_at", nullable = false)
    public LocalDateTime consumedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}