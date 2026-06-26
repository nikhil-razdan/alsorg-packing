package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ven_flow_entries", indexes = {
        @Index(name = "idx_venflow_pd_no", columnList = "pdNo"),
        @Index(name = "idx_venflow_client_name", columnList = "clientName"),
        @Index(name = "idx_venflow_stage", columnList = "stage"),
        @Index(name = "idx_venflow_store_status", columnList = "storeStatus"),
        @Index(name = "idx_venflow_plant_code", columnList = "plant_code"),
        @Index(name = "idx_venflow_po_status", columnList = "po_status"),
        @Index(name = "idx_venflow_production_status", columnList = "production_status"),
        @Index(name = "idx_venflow_order_date", columnList = "orderDate")
})
public class VenFlowEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    public LocalDate orderDate;

    @Column(nullable = false)
    public String pdNo;

    @Column(nullable = false)
    public String clientName;

    @Column(length = 1000)
    public String productDescription;

    public String veneerType;

    @Column(name = "veneer_size")
    public String size;

    @Enumerated(EnumType.STRING)
    public VenFlowStoreStatus storeStatus;

    public String requisitionSlipNo;

    public LocalDate requisitionDate;

    @Column(precision = 12, scale = 3)
    public BigDecimal orderedQty;

    @Column(precision = 12, scale = 3)
    public BigDecimal receivedQty;

    @Column(precision = 12, scale = 3)
    public BigDecimal balanceQty;

    @Enumerated(EnumType.STRING)
    public VenFlowUnit unit;

    public LocalDate expectedDate;

    public LocalDate actualInHouseDate;

    @Column(name = "plant_code", nullable = false)
    public String plantCode;

    @Column(name = "bom_reference")
    public String bomReference;

    @Column(name = "bom_attachment_url")
    public String bomAttachmentUrl;

    @Column(name = "raised_by")
    public String raisedBy;

    @Column(name = "raised_at")
    public LocalDateTime raisedAt;

    @Column(name = "sent_to_purchase_by")
    public String sentToPurchaseBy;

    @Column(name = "sent_to_purchase_at")
    public LocalDateTime sentToPurchaseAt;

    @Column(name = "vendor_name")
    public String vendorName;

    @Column(name = "po_no")
    public String poNo;

    @Column(name = "po_date")
    public LocalDate poDate;

    @Column(name = "po_amount", precision = 14, scale = 2)
    public BigDecimal poAmount;

    @Column(name = "po_document_url", length = 2000)
    public String poDocumentUrl;

    @Column(name = "po_raised_by")
    public String poRaisedBy;

    @Column(name = "po_raised_at")
    public LocalDateTime poRaisedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "po_status", nullable = false)
    public VenFlowPoStatus poStatus = VenFlowPoStatus.NOT_RAISED;

    @Column(name = "po_approved_by")
    public String poApprovedBy;

    @Column(name = "po_approved_at")
    public LocalDateTime poApprovedAt;

    @Column(name = "material_received_by")
    public String materialReceivedBy;

    @Column(name = "material_received_at")
    public LocalDateTime materialReceivedAt;

    @Column(name = "material_informed_by")
    public String materialInformedBy;

    @Column(name = "material_informed_at")
    public LocalDateTime materialInformedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "production_status", nullable = false)
    public VenFlowProductionStatus productionStatus = VenFlowProductionStatus.NOT_STARTED;

    @Column(name = "production_started_by")
    public String productionStartedBy;

    @Column(name = "production_started_at")
    public LocalDateTime productionStartedAt;

    @Column(name = "job_done_by")
    public String jobDoneBy;

    @Column(name = "job_done_at")
    public LocalDateTime jobDoneAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public VenFlowStage stage = VenFlowStage.HEADER_CREATED;

    @Column(length = 2000)
    public String remarks;

    public String createdBy;

    public String updatedBy;

    public LocalDateTime createdAt;

    public LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (stage == null) {
            stage = VenFlowStage.PRODUCTION_RAISED;
        }

        if (poStatus == null) {
            poStatus = VenFlowPoStatus.NOT_RAISED;
        }

        if (productionStatus == null) {
            productionStatus = VenFlowProductionStatus.NOT_STARTED;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}