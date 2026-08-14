package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PartialAvailabilityDecision;
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

/**
 * Production Material Requisition for one Product/BOM.
 *
 * <p>The Production destination remains the final Production location. For the
 * four-plant MatFlow topology, originStore/mainStore persist the Store channel
 * independently of that Production destination:</p>
 *
 * <pre>
 * AL-P1: Production -> AL-P1 Main Store
 * AL-P2/3/4: Production -> own Plant Store -> AL-P1 Main Store
 * </pre>
 *
 * <p>The same MR then returns material through the reverse Store channel. The
 * forwarding fields are nullable for historical rows and are populated for new
 * remote-plant MRs when the origin Store forwards the MR.</p>
 */
@Entity
@Table(name = "mf_requisitions", uniqueConstraints = @UniqueConstraint(name = "uk_mf_requisition_number", columnNames = "requisition_number"), indexes = {
        @Index(name = "idx_mf_req_status", columnList = "status"),
        @Index(name = "idx_mf_req_bom", columnList = "bom_id"),
        @Index(name = "idx_mf_req_destination", columnList = "destination_location_id"),
        @Index(name = "idx_mf_req_origin_store", columnList = "origin_store_id"),
        @Index(name = "idx_mf_req_main_store", columnList = "main_store_id"),
        @Index(name = "idx_mf_req_partial_decision", columnList = "partial_availability_decision")
})
public class MatFlowMaterialRequisition extends MatFlowBaseEntity {

    @Column(name = "requisition_number", nullable = false, length = 120)
    public String requisitionNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_drawing_id", nullable = false)
    public MatFlowProjectDrawing projectDrawing;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bom_id", nullable = false)
    public MatFlowBom bom;

    /** Final Production destination for the specific Production user. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_location_id", nullable = false)
    public MatFlowLocation destinationLocation;

    /**
     * The originating plant Store. For AL-P1 this is the same location as
     * mainStore; for AL-P2/3/4 this is the local Plant Store routing node.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origin_store_id")
    public MatFlowLocation originStore;

    /** Central AL-P1 Main Store that owns planning/reservation/PI/GRN/QC. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "main_store_id")
    public MatFlowLocation mainStore;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public RequisitionStatus status = RequisitionStatus.DRAFT;

    /** Legacy compatibility mirror; not exposed as an active decision. */
    @Enumerated(EnumType.STRING)
    @Column(name = "partial_availability_decision", nullable = false, length = 60)
    public PartialAvailabilityDecision partialAvailabilityDecision = PartialAvailabilityDecision.ISSUE_AVAILABLE_NOW;

    /** Legacy compatibility fields; active workflow does not write them. */
    @Column(name = "partial_decision_by", length = 150)
    public String partialDecisionBy;

    @Column(name = "partial_decision_at")
    public LocalDateTime partialDecisionAt;

    @Column(name = "partial_decision_remarks", columnDefinition = "text")
    public String partialDecisionRemarks;

    @Column(name = "requested_by", nullable = false, length = 150)
    public String requestedBy;

    @Column(name = "requested_at", nullable = false)
    public LocalDateTime requestedAt;

    @Column(name = "submitted_by", length = 150)
    public String submittedBy;

    @Column(name = "submitted_at")
    public LocalDateTime submittedAt;

    /** Explicit remote-Store forwarding audit fields. Null for AL-P1 direct MRs. */
    @Column(name = "forwarded_to_main_store_by", length = 150)
    public String forwardedToMainStoreBy;

    @Column(name = "forwarded_to_main_store_at")
    public LocalDateTime forwardedToMainStoreAt;

    @Column(name = "forwarding_remarks", columnDefinition = "text")
    public String forwardingRemarks;

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
