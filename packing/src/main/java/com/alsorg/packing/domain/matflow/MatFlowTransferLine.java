package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "mf_transfer_lines", indexes = {
        @Index(name = "idx_mf_transfer_line_order", columnList = "transfer_order_id"),
        @Index(name = "idx_mf_transfer_line_material", columnList = "material_id")
})
public class MatFlowTransferLine
        extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transfer_order_id", nullable = false)
    public MatFlowTransferOrder transferOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @Column(name = "route_step_id")
    public UUID routeStepId;

    @Column(name = "planned_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal plannedQty;

    @Column(name = "dispatched_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal dispatchedQty = BigDecimal.ZERO;

    @Column(name = "received_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal receivedQty = BigDecimal.ZERO;

    @Column(name = "uom", nullable = false, length = 40)
    public String uom;
}