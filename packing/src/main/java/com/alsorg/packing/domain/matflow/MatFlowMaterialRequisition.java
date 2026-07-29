package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;

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
@Table(name = "mf_requisitions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_requisition_number", columnNames = "requisition_number")
}, indexes = {
        @Index(name = "idx_mf_req_status", columnList = "status"),
        @Index(name = "idx_mf_req_bom", columnList = "bom_id"),
        @Index(name = "idx_mf_req_destination", columnList = "destination_location_id")
})
public class MatFlowMaterialRequisition
        extends MatFlowBaseEntity {

    @Column(name = "requisition_number", nullable = false, length = 120)
    public String requisitionNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_drawing_id", nullable = false)
    public MatFlowProjectDrawing projectDrawing;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bom_id", nullable = false)
    public MatFlowBom bom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_location_id", nullable = false)
    public MatFlowLocation destinationLocation;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public RequisitionStatus status = RequisitionStatus.DRAFT;

    @Column(name = "requested_by", nullable = false, length = 150)
    public String requestedBy;

    @Column(name = "requested_at", nullable = false)
    public LocalDateTime requestedAt;

    @Column(name = "submitted_by", length = 150)
    public String submittedBy;

    @Column(name = "submitted_at")
    public LocalDateTime submittedAt;

    @Column(name = "planned_by", length = 150)
    public String plannedBy;

    @Column(name = "planned_at")
    public LocalDateTime plannedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;

    @Column(name = "cancelled_by", length = 150)
    public String cancelledBy;

    @Column(name = "cancelled_at")
    public LocalDateTime cancelledAt;

    @Column(name = "cancellation_reason", columnDefinition = "text")
    public String cancellationReason;
}