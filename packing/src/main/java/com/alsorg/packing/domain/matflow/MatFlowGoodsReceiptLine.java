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
@Table(name = "mf_goods_receipt_lines", indexes = {
        @Index(name = "idx_mf_grn_line_grn", columnList = "goods_receipt_id"),
        @Index(name = "idx_mf_grn_line_po_line", columnList = "purchase_order_line_id"),
        @Index(name = "idx_mf_grn_line_material", columnList = "material_id")
})
public class MatFlowGoodsReceiptLine
        extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goods_receipt_id", nullable = false)
    public MatFlowGoodsReceipt goodsReceipt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purchase_order_line_id", nullable = false)
    public MatFlowPurchaseOrderLine purchaseOrderLine;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @Column(name = "received_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal receivedQty;

    @Column(name = "accepted_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal acceptedQty = BigDecimal.ZERO;

    @Column(name = "rejected_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal rejectedQty = BigDecimal.ZERO;

    @Column(name = "returned_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal returnedQty = BigDecimal.ZERO;

    @Column(name = "uom", nullable = false, length = 40)
    public String uom;

    @Column(name = "batch_no", length = 150)
    public String batchNo;
}