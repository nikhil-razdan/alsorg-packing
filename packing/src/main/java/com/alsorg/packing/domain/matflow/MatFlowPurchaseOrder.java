package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mat_flow_purchase_orders", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mat_flow_purchase_order_no", columnNames = "po_no")
}, indexes = {
        @Index(name = "idx_mfpo_indent", columnList = "indent_id"),
        @Index(name = "idx_mfpo_quote", columnList = "quote_id"),
        @Index(name = "idx_mfpo_vendor", columnList = "vendor_name"),
        @Index(name = "idx_mfpo_status", columnList = "status"),
        @Index(name = "idx_mfpo_po_date", columnList = "po_date")
})
public class MatFlowPurchaseOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "po_no", nullable = false, length = 100)
    public String poNo;

    @Column(name = "indent_id", nullable = false)
    public UUID indentId;

    @Column(name = "release_id", nullable = false)
    public UUID releaseId;

    @Column(name = "requisition_id", nullable = false)
    public UUID requisitionId;

    @Column(name = "quote_id")
    public UUID quoteId;

    @Column(name = "indent_no", nullable = false, length = 50)
    public String indentNo;

    @Column(name = "plant_code", nullable = false, length = 100)
    public String plantCode;

    @Column(name = "pd_no", nullable = false, length = 255)
    public String pdNo;

    @Column(name = "vendor_id")
    public UUID vendorId;

    @Column(name = "vendor_name", nullable = false, length = 500)
    public String vendorName;

    @Column(name = "vendor_gstin", length = 100)
    public String vendorGstin;

    @Column(name = "vendor_address", length = 2000)
    public String vendorAddress;

    @Column(name = "po_date", nullable = false)
    public LocalDate poDate;

    @Column(name = "expected_delivery_date")
    public LocalDate expectedDeliveryDate;

    @Column(name = "currency_code", nullable = false, length = 10)
    public String currencyCode = "INR";

    @Column(name = "payment_terms", length = 1000)
    public String paymentTerms;

    @Column(name = "delivery_terms", length = 1000)
    public String deliveryTerms;

    @Column(name = "delivery_address", length = 2000)
    public String deliveryAddress;

    /*
     * Optional future generic attachment reference.
     */
    @Column(name = "po_attachment_id")
    public UUID poAttachmentId;

    @Column(name = "freight_amount", nullable = false, precision = 18, scale = 2)
    public BigDecimal freightAmount = BigDecimal.ZERO.setScale(2);

    @Column(name = "other_charges_amount", nullable = false, precision = 18, scale = 2)
    public BigDecimal otherChargesAmount = BigDecimal.ZERO.setScale(2);

    @Column(name = "subtotal_amount", nullable = false, precision = 18, scale = 2)
    public BigDecimal subtotalAmount = BigDecimal.ZERO.setScale(2);

    @Column(name = "discount_amount", nullable = false, precision = 18, scale = 2)
    public BigDecimal discountAmount = BigDecimal.ZERO.setScale(2);

    @Column(name = "tax_amount", nullable = false, precision = 18, scale = 2)
    public BigDecimal taxAmount = BigDecimal.ZERO.setScale(2);

    @Column(name = "grand_total", nullable = false, precision = 18, scale = 2)
    public BigDecimal grandTotal = BigDecimal.ZERO.setScale(2);

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public MatFlowPurchaseOrderStatus status = MatFlowPurchaseOrderStatus.DRAFT;

    @Column(name = "remarks", length = 2000)
    public String remarks;

    @Column(name = "created_by", nullable = false, length = 255)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "submitted_by", length = 255)
    public String submittedBy;

    @Column(name = "submitted_at")
    public LocalDateTime submittedAt;

    @Column(name = "approved_by", length = 255)
    public String approvedBy;

    @Column(name = "approved_at")
    public LocalDateTime approvedAt;

    @Column(name = "returned_by", length = 255)
    public String returnedBy;

    @Column(name = "returned_at")
    public LocalDateTime returnedAt;

    @Column(name = "return_remarks", length = 2000)
    public String returnRemarks;

    @Column(name = "cancelled_by", length = 255)
    public String cancelledBy;

    @Column(name = "cancelled_at")
    public LocalDateTime cancelledAt;

    @Column(name = "updated_by", length = 255)
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {

        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (poDate == null) {
            poDate = LocalDate.now();
        }

        if (currencyCode == null
                || currencyCode.isBlank()) {

            currencyCode = "INR";
        }

        initializeAmounts();

        if (status == null) {
            status = MatFlowPurchaseOrderStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {

        updatedAt = LocalDateTime.now();

        initializeAmounts();
    }

    private void initializeAmounts() {

        if (freightAmount == null) {
            freightAmount = BigDecimal.ZERO.setScale(2);
        }

        if (otherChargesAmount == null) {
            otherChargesAmount = BigDecimal.ZERO.setScale(2);
        }

        if (subtotalAmount == null) {
            subtotalAmount = BigDecimal.ZERO.setScale(2);
        }

        if (discountAmount == null) {
            discountAmount = BigDecimal.ZERO.setScale(2);
        }

        if (taxAmount == null) {
            taxAmount = BigDecimal.ZERO.setScale(2);
        }

        if (grandTotal == null) {
            grandTotal = BigDecimal.ZERO.setScale(2);
        }
    }
}