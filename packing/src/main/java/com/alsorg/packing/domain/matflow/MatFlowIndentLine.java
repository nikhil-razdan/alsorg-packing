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
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "mat_flow_indent_lines",
        indexes = {
                @Index(
                        name = "idx_mfil_indent",
                        columnList = "indent_id"
                ),
                @Index(
                        name = "idx_mfil_requisition_line",
                        columnList = "requisition_line_id"
                ),
                @Index(
                        name = "idx_mfil_matflow_line",
                        columnList = "mat_flow_line_id"
                ),
                @Index(
                        name = "idx_mfil_status",
                        columnList = "status"
                )
        }
)
public class MatFlowIndentLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "indent_id",
            nullable = false
    )
    public UUID indentId;

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

    @Column(name = "source_bom_item_id")
    public UUID sourceBomItemId;

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

    /*
     * Shortage quantity when this indent line was created.
     */
    @Column(
            name = "shortage_qty_snapshot",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal shortageQtySnapshot =
            BigDecimal.ZERO.setScale(3);

    @Column(
            name = "indent_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal indentQty =
            BigDecimal.ZERO.setScale(3);

    /*
     * These quantities will be maintained by the future
     * Purchase and Receipt workflow.
     */
    @Column(
            name = "ordered_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal orderedQty =
            BigDecimal.ZERO.setScale(3);

    @Column(
            name = "received_qty",
            nullable = false,
            precision = 14,
            scale = 3
    )
    public BigDecimal receivedQty =
            BigDecimal.ZERO.setScale(3);

    @Enumerated(EnumType.STRING)
    @Column(
            name = "unit",
            nullable = false,
            length = 50
    )
    public MaterialUnit unit;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 50
    )
    public MatFlowIndentLineStatus status =
            MatFlowIndentLineStatus.DRAFT;

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
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        initializeQuantities();

        if (status == null) {
            status = MatFlowIndentLineStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();

        initializeQuantities();
    }

    private void initializeQuantities() {
        if (shortageQtySnapshot == null) {
            shortageQtySnapshot = BigDecimal.ZERO.setScale(3);
        }

        if (indentQty == null) {
            indentQty = BigDecimal.ZERO.setScale(3);
        }

        if (orderedQty == null) {
            orderedQty = BigDecimal.ZERO.setScale(3);
        }

        if (receivedQty == null) {
            receivedQty = BigDecimal.ZERO.setScale(3);
        }
    }
}