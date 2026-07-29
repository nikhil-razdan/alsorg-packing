package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "mf_indent_lines", indexes = {
        @Index(name = "idx_mf_indent_line_indent", columnList = "indent_id"),
        @Index(name = "idx_mf_indent_line_material", columnList = "material_id")
})
public class MatFlowIndentLine
        extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "indent_id", nullable = false)
    public MatFlowIndent indent;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requisition_line_id", nullable = false)
    public MatFlowRequisitionLine requisitionLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @Column(name = "required_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal requiredQty;

    @Column(name = "ordered_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal orderedQty = BigDecimal.ZERO;

    @Column(name = "received_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal receivedQty = BigDecimal.ZERO;

    @Column(name = "uom", nullable = false, length = 40)
    public String uom;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}