package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.GoodsReceiptStatus;

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

@Entity
@Table(name = "mf_goods_receipts", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_grn_number", columnNames = "grn_number")
}, indexes = {
        @Index(name = "idx_mf_grn_po", columnList = "purchase_order_id"),
        @Index(name = "idx_mf_grn_location", columnList = "receipt_location_id"),
        @Index(name = "idx_mf_grn_status", columnList = "status")
})
public class MatFlowGoodsReceipt
        extends MatFlowBaseEntity {

    @Column(name = "grn_number", nullable = false, length = 150)
    public String grnNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "purchase_order_id", nullable = false)
    public MatFlowPurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receipt_location_id", nullable = false)
    public MatFlowLocation receiptLocation;

    @Column(name = "vendor_challan_no", length = 150)
    public String vendorChallanNo;

    @Column(name = "vendor_invoice_no", length = 150)
    public String vendorInvoiceNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public GoodsReceiptStatus status = GoodsReceiptStatus.QC_PENDING;

    @Column(name = "received_by", nullable = false, length = 150)
    public String receivedBy;

    @Column(name = "received_at", nullable = false)
    public LocalDateTime receivedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}