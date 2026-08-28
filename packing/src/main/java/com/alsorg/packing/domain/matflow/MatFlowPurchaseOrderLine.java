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
@Table(name = "mf_purchase_order_lines", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_po_indent_line", columnNames = {
                "purchase_order_id", "indent_line_id"
        })
}, indexes = {
        @Index(name = "idx_mf_po_line_order", columnList = "purchase_order_id"),
        @Index(name = "idx_mf_po_line_material", columnList = "material_id")
})
public class MatFlowPurchaseOrderLine extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purchase_order_id", nullable = false)
    public MatFlowPurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "indent_line_id", nullable = false)
    public MatFlowIndentLine indentLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @Column(name = "ordered_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal orderedQty;

    @Column(name = "received_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal receivedQty = BigDecimal.ZERO;

    @Column(name = "uom", nullable = false, length = 40)
    public String uom;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}
