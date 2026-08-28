package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;

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

import java.util.UUID;

@Entity
@Table(name = "mf_transfer_orders", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_transfer_number", columnNames = "transfer_number")
}, indexes = {
        @Index(name = "idx_mf_transfer_status", columnList = "status"),
        @Index(name = "idx_mf_transfer_from", columnList = "from_location_id"),
        @Index(name = "idx_mf_transfer_to", columnList = "to_location_id"),
        @Index(name = "idx_mf_transfer_requisition", columnList = "requisition_id")
})
public class MatFlowTransferOrder extends MatFlowBaseEntity {

    @Column(name = "transfer_number", nullable = false, length = 120)
    public String transferNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_id", nullable = false)
    public MatFlowMaterialRequisition requisition;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false)
    public MatFlowReservation reservation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_location_id", nullable = false)
    public MatFlowLocation fromLocation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_location_id", nullable = false)
    public MatFlowLocation toLocation;

    @Column(name = "route_sequence_no", nullable = false)
    public Integer routeSequenceNo;

    @Column(name = "predecessor_transfer_id")
    public UUID predecessorTransferId;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, length = 60)
    public TransferPurpose purpose;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    public TransferStatus status = TransferStatus.PLANNED;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}
