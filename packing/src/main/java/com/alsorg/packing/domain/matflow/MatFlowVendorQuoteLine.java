package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.bomflow.MaterialUnit;

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
        name = "mat_flow_vendor_quote_lines",
        indexes = {
                @Index(
                        name = "idx_mfvql_quote",
                        columnList = "quote_id"
                ),
                @Index(
                        name = "idx_mfvql_indent_line",
                        columnList = "indent_line_id"
                ),
                @Index(
                        name = "idx_mfvql_matflow_line",
                        columnList = "mat_flow_line_id"
                ),
                @Index(
                        name = "idx_mfvql_status",
                        columnList = "status"
                )
        }
)
public class MatFlowVendorQuoteLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "quote_id",
            nullable = false
    )
    public UUID quoteId;

    @Column(
            name = "indent_line_id",
            nullable = false
    )
    public UUID indentLineId;

    @Column(
            name = "requisition_line_id",
            nullable = false
    )
    public UUID requisitionLineId;

    @Column(
            name = "mat_flow_line_id",
            nullable = false
    )
    public UUID matFlowLineId;

    @Column(
            name = "source_line_no",
            nullable = false
    )
    public Integer sourceLineNo;

    @Column(
            name = "item_code",
            length = 255
    )
    public String itemCode;

    @Column(
            name = "item_name",
            nullable = false,
            length = 500
    )
    public String itemName;

    @Column(
            name = "item_description",
            length = 2000
    )
    public String itemDescription;

    @Column(
            name = "specification",
            length = 1000
    )
    public String specification;

    @Column(
            name = "quoted_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal quotedQty =
            BigDecimal.ZERO.setScale(3);

    @Column(
            name = "selected_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal selectedQty =
            BigDecimal.ZERO.setScale(3);

    @Enumerated(EnumType.STRING)
    @Column(
            name = "unit",
            nullable = false,
            length = 50
    )
    public MaterialUnit unit;

    @Column(
            name = "unit_rate",
            nullable = false,
            precision = 16,
            scale = 4
    )
    public BigDecimal unitRate =
            BigDecimal.ZERO.setScale(4);

    @Column(
            name = "discount_percent",
            nullable = false,
            precision = 8,
            scale = 3
    )
    public BigDecimal discountPercent =
            BigDecimal.ZERO.setScale(3);

    @Column(
            name = "tax_percent",
            nullable = false,
            precision = 8,
            scale = 3
    )
    public BigDecimal taxPercent =
            BigDecimal.ZERO.setScale(3);

    @Column(
            name = "line_subtotal",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal lineSubtotal =
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
            name = "taxable_amount",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal taxableAmount =
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
            name = "line_total",
            nullable = false,
            precision = 18,
            scale = 2
    )
    public BigDecimal lineTotal =
            BigDecimal.ZERO.setScale(2);

    @Column(name = "lead_time_days")
    public Integer leadTimeDays;

    @Column(name = "promised_delivery_date")
    public LocalDate promisedDeliveryDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 50
    )
    public MatFlowVendorQuoteLineStatus status =
            MatFlowVendorQuoteLineStatus.DRAFT;

    @Column(
            name = "remarks",
            length = 2000
    )
    public String remarks;

    @Column(
            name = "active",
            nullable = false
    )
    public boolean active = true;

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

        initializeAmounts();

        if (status == null) {
            status =
                    MatFlowVendorQuoteLineStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {

        updatedAt =
                LocalDateTime.now();

        initializeAmounts();
    }

    private void initializeAmounts() {

        if (quotedQty == null) {
            quotedQty =
                    BigDecimal.ZERO.setScale(3);
        }

        if (selectedQty == null) {
            selectedQty =
                    BigDecimal.ZERO.setScale(3);
        }

        if (unitRate == null) {
            unitRate =
                    BigDecimal.ZERO.setScale(4);
        }

        if (discountPercent == null) {
            discountPercent =
                    BigDecimal.ZERO.setScale(3);
        }

        if (taxPercent == null) {
            taxPercent =
                    BigDecimal.ZERO.setScale(3);
        }

        if (lineSubtotal == null) {
            lineSubtotal =
                    BigDecimal.ZERO.setScale(2);
        }

        if (discountAmount == null) {
            discountAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (taxableAmount == null) {
            taxableAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (taxAmount == null) {
            taxAmount =
                    BigDecimal.ZERO.setScale(2);
        }

        if (lineTotal == null) {
            lineTotal =
                    BigDecimal.ZERO.setScale(2);
        }
    }
}