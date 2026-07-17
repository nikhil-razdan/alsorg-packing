package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;
import java.util.LinkedHashSet;
import java.util.Set;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ven_flow_qc_inspections", indexes = {
        @Index(name = "idx_vf_qc_entry", columnList = "entry_id"),
        @Index(name = "idx_vf_qc_allocation", columnList = "allocation_id")
})
public class VenFlowQcInspection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "entry_id", nullable = false)
    public UUID entryId;

    @Column(name = "allocation_id", nullable = false)
    public UUID allocationId;

    @Column(name = "inspected_qty", nullable = false, precision = 12, scale = 3)
    public BigDecimal inspectedQty;

    @Column(name = "accepted_qty", nullable = false, precision = 12, scale = 3)
    public BigDecimal acceptedQty;

    @Column(name = "rejected_qty", nullable = false, precision = 12, scale = 3)
    public BigDecimal rejectedQty;

    @Column(name = "hold_qty", nullable = false, precision = 12, scale = 3)
    public BigDecimal holdQty;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "ven_flow_qc_inspection_evidence", joinColumns = @JoinColumn(name = "inspection_id"))
    @Column(name = "attachment_id", nullable = false)
    public Set<UUID> evidenceAttachmentIds = new LinkedHashSet<>();

    @Column(name = "sample_available", nullable = false)
    public boolean sampleAvailable;

    @Column(name = "sample_compared")
    public Boolean sampleCompared;

    @Column(name = "grain_match")
    public Boolean grainMatch;

    @Column(name = "shade_match")
    public Boolean shadeMatch;

    @Column(name = "thickness_ok")
    public Boolean thicknessOk;

    @Column(name = "size_ok")
    public Boolean sizeOk;

    @Column(name = "surface_condition_ok")
    public Boolean surfaceConditionOk;

    @Column(name = "qc_remarks", length = 2000)
    public String qcRemarks;

    @Column(name = "rejection_reason", length = 2000)
    public String rejectionReason;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "ven_flow_qc_inspection_evidence_urls", joinColumns = @JoinColumn(name = "qc_inspection_id"))
    @Column(name = "evidence_url", nullable = false, length = 2000)
    public Set<String> evidenceUrls = new LinkedHashSet<>();

    @Column(name = "checked_by", nullable = false)
    public String checkedBy;

    @Column(name = "checked_at", nullable = false)
    public LocalDateTime checkedAt;

    @PrePersist
    public void prePersist() {
        if (checkedAt == null) {
            checkedAt = LocalDateTime.now();
        }
    }
}