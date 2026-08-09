package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PartialAvailabilityDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "mf_requisitions", uniqueConstraints = @UniqueConstraint(name = "uk_mf_requisition_number", columnNames = "requisition_number"), indexes = {
                @Index(name = "idx_mf_req_status", columnList = "status"),
                @Index(name = "idx_mf_req_bom", columnList = "bom_id"),
                @Index(name = "idx_mf_req_destination", columnList = "destination_location_id"),
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
        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "destination_location_id", nullable = false)
        public MatFlowLocation destinationLocation;
        @Enumerated(EnumType.STRING)
        @Column(name = "status", nullable = false, length = 50)
        public RequisitionStatus status = RequisitionStatus.DRAFT;
        @Enumerated(EnumType.STRING)
        @Column(name = "partial_availability_decision", nullable = false, length = 60)
        public PartialAvailabilityDecision partialAvailabilityDecision = PartialAvailabilityDecision.UNDECIDED;
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
