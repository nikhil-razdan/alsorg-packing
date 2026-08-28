package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcRoutingDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mf_qc_inspections", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_qc_source_line", columnNames = {"source_type", "source_line_id"})
}, indexes = {
        @Index(name = "idx_mf_qc_status", columnList = "status"),
        @Index(name = "idx_mf_qc_material", columnList = "material_id"),
        @Index(name = "idx_mf_qc_location", columnList = "location_id"),
        @Index(name = "idx_mf_qc_source", columnList = "source_type,source_id"),
        @Index(name = "idx_mf_qc_routing", columnList = "routing_decision,routing_decided_at")
})
public class MatFlowQcInspection extends MatFlowBaseEntity {

    @Column(name = "inspection_number", nullable = false, unique = true, length = 80)
    public String inspectionNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 40)
    public QcSourceType sourceType;

    @Column(name = "source_id", nullable = false)
    public UUID sourceId;

    @Column(name = "source_line_id", nullable = false)
    public UUID sourceLineId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    public MatFlowLocation location;

    @Column(name = "inspection_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal inspectionQty = BigDecimal.ZERO;

    @Column(name = "accepted_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal acceptedQty = BigDecimal.ZERO;

    @Column(name = "rejected_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal rejectedQty = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    public QcInspectionStatus status = QcInspectionStatus.PENDING;

    @Column(name = "inspected_by", length = 150)
    public String inspectedBy;

    @Column(name = "inspected_at")
    public LocalDateTime inspectedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;

    @Enumerated(EnumType.STRING)
    @Column(name = "routing_decision", length = 50)
    public QcRoutingDecision routingDecision;

    @Column(name = "processing_route_step_id")
    public UUID processingRouteStepId;

    @Column(name = "routing_reservation_id")
    public UUID routingReservationId;

    @Column(name = "routing_decided_by", length = 150)
    public String routingDecidedBy;

    @Column(name = "routing_decided_at")
    public LocalDateTime routingDecidedAt;

    @Column(name = "routing_remarks", columnDefinition = "text")
    public String routingRemarks;
}
