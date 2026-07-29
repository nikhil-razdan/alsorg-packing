package com.alsorg.packing.domain.matflow;

import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "mf_production_consumption_lines", indexes = {
        @Index(name = "idx_mf_consumption_line_header", columnList = "consumption_id"),
        @Index(name = "idx_mf_consumption_line_material", columnList = "material_id")
})
public class MatFlowProductionConsumptionLine
        extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "consumption_id", nullable = false)
    public MatFlowProductionConsumption consumption;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_line_id", nullable = false)
    public MatFlowRequisitionLine requisitionLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @Column(name = "consumed_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal consumedQty;

    @Column(name = "uom", nullable = false, length = 40)
    public String uom;

    @Column(name = "batch_no", length = 150)
    public String batchNo;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}