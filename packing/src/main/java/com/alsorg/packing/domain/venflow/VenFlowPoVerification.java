package com.alsorg.packing.domain.venflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "ven_flow_po_verifications",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_vf_po_verification_revision",
                        columnNames = {
                                "entry_id",
                                "verification_revision"
                        })
        },
        indexes = {
                @Index(
                        name = "idx_vf_po_verification_entry",
                        columnList = "entry_id"),

                @Index(
                        name = "idx_vf_po_verification_status",
                        columnList = "verification_status"),

                @Index(
                        name = "idx_vf_po_verification_allocation",
                        columnList = "allocation_id"),

                @Index(
                        name = "idx_vf_po_verification_created",
                        columnList = "created_at")
        })
public class VenFlowPoVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(
            name = "entry_id",
            nullable = false)
    public UUID entryId;

    @Column(
            name = "allocation_id",
            nullable = false)
    public UUID allocationId;

    @Column(
            name = "verification_revision",
            nullable = false)
    public Integer revision;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "verification_status",
            nullable = false,
            length = 50)
    public VenFlowPoVerificationStatus status =
            VenFlowPoVerificationStatus.PENDING;

    /*
     * Requirement snapshot.
     */

    @Column(
            name = "plant_code",
            length = 100)
    public String plantCode;

    @Column(
            name = "pd_no",
            length = 150)
    public String pdNo;

    @Column(
            name = "drawing_no",
            length = 150)
    public String drawingNo;

    @Column(
            name = "client_name",
            length = 255)
    public String clientName;

    @Column(
            name = "material_name",
            length = 500)
    public String materialName;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "unit",
            length = 50)
    public VenFlowUnit unit;

    /*
     * Purchase requirement snapshot.
     */

    @Column(
            name = "purchase_request_no",
            length = 255)
    public String purchaseRequestNo;

    @Column(
            name = "planned_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal plannedQty;

    /*
     * Submitted PO snapshot.
     */

    @Column(
            name = "vendor_name",
            nullable = false,
            length = 500)
    public String vendorName;

    @Column(
            name = "po_no",
            nullable = false,
            length = 255)
    public String poNo;

    @Column(
            name = "po_date",
            nullable = false)
    public LocalDate poDate;

    @Column(
            name = "ordered_qty",
            nullable = false,
            precision = 14,
            scale = 3)
    public BigDecimal orderedQty;

    @Column(
            name = "po_amount",
            nullable = false,
            precision = 18,
            scale = 2)
    public BigDecimal poAmount;

    @Column(
            name = "po_attachment_id",
            nullable = false)
    public UUID poAttachmentId;

    /*
     * Snapshot creation and decision.
     */

    @Column(
            name = "created_by",
            nullable = false,
            length = 150)
    public String createdBy;

    @Column(
            name = "created_at",
            nullable = false)
    public LocalDateTime createdAt;

    @Column(
            name = "decided_by",
            length = 150)
    public String decidedBy;

    @Column(
            name = "decided_at")
    public LocalDateTime decidedAt;

    @Column(
            name = "decision_remarks",
            length = 3000)
    public String decisionRemarks;

    @Version
    @Column(
            name = "row_version",
            nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        if (status == null) {
            status =
                    VenFlowPoVerificationStatus.PENDING;
        }
    }
}