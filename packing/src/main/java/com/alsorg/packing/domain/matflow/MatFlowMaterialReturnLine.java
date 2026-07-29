package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;

@Entity
@Table(name = "mf_material_return_lines", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_return_requisition_line", columnNames = {
                "material_return_id",
                "requisition_line_id"
        })
}, indexes = {
        @Index(name = "idx_mf_return_line_header", columnList = "material_return_id"),
        @Index(name = "idx_mf_return_line_material", columnList = "material_id")
})
public class MatFlowMaterialReturnLine
        extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_return_id", nullable = false)
    public MatFlowMaterialReturn materialReturn;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_line_id", nullable = false)
    public MatFlowRequisitionLine requisitionLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @Column(name = "return_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal returnQty;

    @Column(name = "dispatched_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal dispatchedQty = BigDecimal.ZERO;

    @Column(name = "received_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal receivedQty = BigDecimal.ZERO;

    @Column(name = "uom", nullable = false, length = 40)
    public String uom;

    @Column(name = "batch_no", length = 150)
    public String batchNo;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}