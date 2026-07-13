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

    @Column(name = "sent_to_store_by")
    public String sentToStoreBy;

    @Column(name = "sent_to_store_at")
    public LocalDateTime sentToStoreAt;

    @Column(name = "store_reviewed_by")
    public String storeReviewedBy;

    @Column(name = "store_reviewed_at")
    public LocalDateTime storeReviewedAt;

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
    public VenFlowStage stage = VenFlowStage.INDENT_CREATED;

    @Column(name = "current_department")
    public String currentDepartment;

    @Column(name = "stage_entered_at")
    public LocalDateTime stageEnteredAt;

    @Column(name = "stage_changed_by")
    public String stageChangedBy;

    @Column(name = "last_movement_at")
    public LocalDateTime lastMovementAt;

    @Column(name = "priority")
    public String priority = "NORMAL";

    @Column(length = 2000)
    public String remarks;

    public String createdBy;

    public String updatedBy;

    public LocalDateTime createdAt;

    public LocalDateTime updatedAt;

    @Column(name = "drawing_no")
    public String drawingNo;

    @Column(name = "material_name")
    public String materialName;

    @Column(name = "thickness")
    public String thickness;

    @Column(name = "sample_image_url", length = 2000)
    public String sampleImageUrl;

    @Column(name = "required_qty", precision = 12, scale = 3)
    public BigDecimal requiredQty;

    @Column(name = "available_qty", precision = 12, scale = 3)
    public BigDecimal availableQty;

    @Column(name = "reserved_qty", precision = 12, scale = 3)
    public BigDecimal reservedQty;

    @Column(name = "issued_qty", precision = 12, scale = 3)
    public BigDecimal issuedQty;

    @Column(name = "used_qty", precision = 12, scale = 3)
    public BigDecimal usedQty;

    @Column(name = "wastage_qty", precision = 12, scale = 3)
    public BigDecimal wastageQty;

    @Enumerated(EnumType.STRING)
    @Column(name = "stock_decision")
    public VenFlowStockDecision stockDecision = VenFlowStockDecision.PENDING;

    @Column(name = "purchase_request_no")
    public String purchaseRequestNo;

    @Column(name = "purchase_request_by")
    public String purchaseRequestBy;

    @Column(name = "purchase_request_at")
    public LocalDateTime purchaseRequestAt;

    @Column(name = "po_approval_requested_by")
    public String poApprovalRequestedBy;

    @Column(name = "po_approval_requested_at")
    public LocalDateTime poApprovalRequestedAt;

    @Column(name = "director_approval_remarks", length = 2000)
    public String directorApprovalRemarks;

    @Column(name = "director_approved_by")
    public String directorApprovedBy;

    @Column(name = "director_approved_at")
    public LocalDateTime directorApprovedAt;

    @Column(name = "director_rejected_by")
    public String directorRejectedBy;

    @Column(name = "director_rejected_at")
    public LocalDateTime directorRejectedAt;

    @Column(name = "vendor_order_reference")
    public String vendorOrderReference;

    @Column(name = "vendor_acknowledgement_no")
    public String vendorAcknowledgementNo;

    @Column(name = "vendor_order_placed_by")
    public String vendorOrderPlacedBy;

    @Column(name = "vendor_order_placed_at")
    public LocalDateTime vendorOrderPlacedAt;

    @Column(name = "vendor_expected_date")
    public LocalDate vendorExpectedDate;

    @Column(name = "vendor_order_remarks", length = 2000)
    public String vendorOrderRemarks;

    @Column(name = "grn_no")
    public String grnNo;

    @Column(name = "grn_date")
    public LocalDate grnDate;

    @Column(name = "grn_by")
    public String grnBy;

    @Column(name = "grn_at")
    public LocalDateTime grnAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "qc_status")
    public VenFlowQcStatus qcStatus = VenFlowQcStatus.NOT_REQUIRED;

    @Column(name = "qc_checked_by")
    public String qcCheckedBy;

    @Column(name = "qc_checked_at")
    public LocalDateTime qcCheckedAt;

    @Column(name = "qc_remarks", length = 2000)
    public String qcRemarks;

    @Column(name = "inventory_accepted_by")
    public String inventoryAcceptedBy;

    @Column(name = "inventory_accepted_at")
    public LocalDateTime inventoryAcceptedAt;

    @Column(name = "rejection_reason", length = 2000)
    public String rejectionReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "issue_status")
    public VenFlowIssueStatus issueStatus = VenFlowIssueStatus.NOT_RESERVED;

    @Column(name = "reserved_by")
    public String reservedBy;

    @Column(name = "reserved_at")
    public LocalDateTime reservedAt;

    @Column(name = "issued_to")
    public String issuedTo;

    @Column(name = "issued_by")
    public String issuedBy;

    @Column(name = "issued_at")
    public LocalDateTime issuedAt;

    @Column(name = "production_details", length = 2000)
    public String productionDetails;

    @Enumerated(EnumType.STRING)
    @Column(name = "processing_status")
    public VenFlowProcessingStatus processingStatus = VenFlowProcessingStatus.NOT_STARTED;

    @Column(name = "processing_started_by")
    public String processingStartedBy;

    @Column(name = "processing_started_at")
    public LocalDateTime processingStartedAt;

    @Column(name = "process_completed_by")
    public String processCompletedBy;

    @Column(name = "process_completed_at")
    public LocalDateTime processCompletedAt;

    @Column(name = "output_image_url", length = 2000)
    public String outputImageUrl;

    @Column(name = "supervisor_name")
    public String supervisorName;

    @Column(name = "supervisor_informed_by")
    public String supervisorInformedBy;

    @Column(name = "supervisor_informed_at")
    public LocalDateTime supervisorInformedAt;

    @Column(name = "next_stage_ready_by")
    public String nextStageReadyBy;

    @Column(name = "next_stage_ready_at")
    public LocalDateTime nextStageReadyAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (stage == null) {
            stage = VenFlowStage.INDENT_CREATED;
        }

        if (stageEnteredAt == null) {
            stageEnteredAt = now;
        }

        if (lastMovementAt == null) {
            lastMovementAt = now;
        }

        if (currentDepartment == null || currentDepartment.isBlank()) {
            currentDepartment = "ENGINEERING";
        }

        if (priority == null || priority.isBlank()) {
            priority = "NORMAL";
        }

        if (stockDecision == null) {
            stockDecision = VenFlowStockDecision.PENDING;
        }

        if (storeStatus == null) {
            storeStatus = VenFlowStoreStatus.PENDING;
        }

        if (poStatus == null) {
            poStatus = VenFlowPoStatus.NOT_RAISED;
        }

        if (qcStatus == null) {
            qcStatus = VenFlowQcStatus.NOT_REQUIRED;
        }

        if (issueStatus == null) {
            issueStatus = VenFlowIssueStatus.NOT_RESERVED;
        }

        if (processingStatus == null) {
            processingStatus = VenFlowProcessingStatus.NOT_STARTED;
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