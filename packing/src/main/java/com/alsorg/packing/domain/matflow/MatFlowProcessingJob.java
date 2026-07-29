package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "mf_processing_jobs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_processing_job_number", columnNames = "job_number"),
        @UniqueConstraint(name = "uk_mf_processing_reservation_step", columnNames = {
                "reservation_id",
                "route_step_id"
        })
}, indexes = {
        @Index(name = "idx_mf_processing_status", columnList = "status"),
        @Index(name = "idx_mf_processing_location", columnList = "location_id")
})
public class MatFlowProcessingJob
        extends MatFlowBaseEntity {

    @Column(name = "job_number", nullable = false, length = 150)
    public String jobNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_id", nullable = false)
    public MatFlowMaterialRequisition requisition;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false)
    public MatFlowReservation reservation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_step_id", nullable = false)
    public MatFlowBomRouteStep routeStep;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    public MatFlowLocation location;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "input_material_id", nullable = false)
    public MatFlowMaterial inputMaterial;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "output_material_id", nullable = false)
    public MatFlowMaterial outputMaterial;

    @Column(name = "planned_input_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal plannedInputQty;

    @Column(name = "actual_input_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal actualInputQty = BigDecimal.ZERO;

    @Column(name = "output_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal outputQty = BigDecimal.ZERO;

    @Column(name = "wastage_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal wastageQty = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public ProcessingJobStatus status = ProcessingJobStatus.PENDING;

    @Column(name = "started_by", length = 150)
    public String startedBy;

    @Column(name = "started_at")
    public LocalDateTime startedAt;

    @Column(name = "completed_by", length = 150)
    public String completedBy;

    @Column(name = "completed_at")
    public LocalDateTime completedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}