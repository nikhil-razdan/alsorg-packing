package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnReason;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(name = "mf_material_returns", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_material_return_number", columnNames = "return_number")
}, indexes = {
        @Index(name = "idx_mf_return_requisition", columnList = "requisition_id"),
        @Index(name = "idx_mf_return_from", columnList = "from_location_id"),
        @Index(name = "idx_mf_return_to", columnList = "to_location_id"),
        @Index(name = "idx_mf_return_status", columnList = "status")
})
public class MatFlowMaterialReturn
        extends MatFlowBaseEntity {

    @Column(name = "return_number", nullable = false, length = 150)
    public String returnNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_id", nullable = false)
    public MatFlowMaterialRequisition requisition;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_location_id", nullable = false)
    public MatFlowLocation fromLocation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_location_id", nullable = false)
    public MatFlowLocation toLocation;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 50)
    public MaterialReturnReason reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public MaterialReturnStatus status = MaterialReturnStatus.DRAFT;

    @Column(name = "created_for_return_by", nullable = false, length = 150)
    public String createdForReturnBy;

    @Column(name = "dispatched_by", length = 150)
    public String dispatchedBy;

    @Column(name = "dispatched_at")
    public LocalDateTime dispatchedAt;

    @Column(name = "received_by", length = 150)
    public String receivedBy;

    @Column(name = "received_at")
    public LocalDateTime receivedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}