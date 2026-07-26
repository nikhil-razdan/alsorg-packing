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
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "mat_flow_vendor_quotes",
        indexes = {
                @Index(
                        name = "idx_mfvq_indent",
                        columnList = "indent_id"
                ),
                @Index(
                        name = "idx_mfvq_vendor",
                        columnList = "vendor_name"
                ),
                @Index(
                        name = "idx_mfvq_status",
                        columnList = "status"
                ),
                @Index(
                        name = "idx_mfvq_quote_date",
                        columnList = "quote_date"
                )
        }
)
public class MatFlowVendorQuote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "indent_id",
            nullable = false
    )
    public UUID indentId;

    @Column(
            name = "release_id",
            nullable = false
    )
    public UUID releaseId;

    @Column(
            name = "requisition_id",
            nullable = false
    )
    public UUID requisitionId;

    @Column(
            name = "indent_no",
            nullable = false,
            length = 50
    )
    public String indentNo;

    @Column(
            name = "plant_code",
            nullable = false,
            length = 100
    )
    public String plantCode;

    @Column(
            name = "pd_no",
            nullable = false,
            length = 255
    )
    public String pdNo;

    @Column(name = "vendor_id")
    public UUID vendorId;

    @Column(
            name = "vendor_name",
            nullable = false,
            length = 500
    )
    public String vendorName;

    @Column(
            name = "vendor_gstin",
            length = 100
    )
    public String vendorGstin;

    @Column(
            name = "vendor_address",
            length = 2000
    )
    public String vendorAddress;

    /*
     * Vendor's own quotation reference.
     */
    @Column(
            name = "quote_no",
            nullable = false,
            length = 150
    )
    public String quoteNo;

    @Column(
            name = "quote_date",
            nullable = false
    )
    public LocalDate quoteDate;

    @Column(name = "valid_until")
    public LocalDate validUntil;

    @Column(
            name = "currency_code",
            nullable = false,
            length = 10
    )
    public String currencyCode = "INR";

    /*
     * Optional future generic attachment reference.
     */
    @Column(name = "quote_attachment_id")
    public UUID quoteAttachmentId;

    @Column(
            name = "payment_terms",
            length = 1000
    )
    public String paymentTerms;

    @Column(
            name = "delivery_terms",
            length = 1000
    )
    public String deliveryTerms;

    @Column(
            name = "freight_amount",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal freightAmount =
            BigDecimal.ZERO.setScale(2);

    @Column(
            name = "other_charges_amount",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal otherChargesAmount =
            BigDecimal.ZERO.setScale(2);

    @Column(
            name = "subtotal_amount",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal subtotalAmount =
            BigDecimal.ZERO.setScale(2);

    @Column(
            name = "discount_amount",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal discountAmount =
            BigDecimal.ZERO.setScale(2);

    @Column(
            name = "tax_amount",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal taxAmount =
            BigDecimal.ZERO.setScale(2);

    @Column(
            name = "grand_total",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal grandTotal =
            BigDecimal.ZERO.setScale(2);

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 50
    )
    public MatFlowVendorQuoteStatus status =
            MatFlowVendorQuoteStatus.DRAFT;

    @Column(
            name = "remarks",
            length = 2000
    )
    public String remarks;

    @Column(
            name = "created_by",
            nullable = false,
            length = 255
    )
    public String createdBy;

    @Column(
            name = "created_at",
            nullable = false
    )
    public LocalDateTime createdAt;

    @Column(
            name = "submitted_by",
            length = 255
    )
    public String submittedBy;

    @Column(name = "submitted_at")
    public LocalDateTime submittedAt;

    @Column(
            name = "updated_by",
            length = 255
    )
    public String updatedBy;

    @Column(
            name = "updated_at",
            nullable = false
    )
    public LocalDateTime updatedAt;

    @Version
    @Column(
            name = "row_version",
            nullable = false
    )
    public Long rowVersion;

    @PrePersist
    public void prePersist() {

        LocalDateTime now =
                LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (currencyCode == null
                || currencyCode.isBlank()) {

            currencyCode = "INR";
        }

        initializeAmounts();

        if (status == null) {
            status =
                    MatFlowVendorQuoteStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {

        updatedAt =
                LocalDateTime.now();

        initializeAmounts();
    }

    private void initializeAmounts() {

        if (freightAmount == null) {
            freightAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (otherChargesAmount == null) {
            otherChargesAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (subtotalAmount == null) {
            subtotalAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (discountAmount == null) {
            discountAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (taxAmount == null) {
            taxAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (grandTotal == null) {
            grandTotal =
                    BigDecimal.ZERO.setScale(2);
        }
    }
}