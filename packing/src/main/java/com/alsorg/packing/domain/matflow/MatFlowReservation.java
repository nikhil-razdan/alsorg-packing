package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Entity
@Table(name = "mf_reservations", indexes = {
        @Index(name = "idx_mf_reservation_req_line", columnList = "requisition_line_id"),
        @Index(name = "idx_mf_reservation_source", columnList = "source_location_id"),
        @Index(name = "idx_mf_reservation_status", columnList = "status")
})
public class MatFlowReservation extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_line_id", nullable = false)
    public MatFlowRequisitionLine requisitionLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_location_id", nullable = false)
    public MatFlowLocation sourceLocation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "first_destination_location_id", nullable = false)
    public MatFlowLocation firstDestinationLocation;

    @Column(name = "demand_plant_code", nullable = false, length = 50)
    public String demandPlantCode;

    @Column(name = "reserved_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal reservedQty;

    @Column(name = "issued_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal issuedQty = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    public ReservationStatus status = ReservationStatus.ACTIVE;

    @Column(name = "route_snapshot_json", columnDefinition = "text")
    public String routeSnapshotJson;

    public BigDecimal remainingIssueQty() {
        BigDecimal reserved = reservedQty == null ? BigDecimal.ZERO : reservedQty;
        BigDecimal issued = issuedQty == null ? BigDecimal.ZERO : issuedQty;
        return reserved.subtract(issued)
                .max(BigDecimal.ZERO)
                .setScale(3, RoundingMode.HALF_UP);
    }
}
