package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionType;

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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "mf_qc_dispositions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_qc_disposition_number", columnNames = "disposition_number")
}, indexes = {
        @Index(name = "idx_mf_qc_disposition_inspection", columnList = "qc_inspection_id"),
        @Index(name = "idx_mf_qc_disposition_status", columnList = "status")
})
public class MatFlowQcDisposition extends MatFlowBaseEntity {

    @Column(name = "disposition_number", nullable = false, length = 150)
    public String dispositionNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "qc_inspection_id", nullable = false)
    public MatFlowQcInspection qcInspection;

    @Enumerated(EnumType.STRING)
    @Column(name = "disposition_type", nullable = false, length = 50)
    public QcDispositionType dispositionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public QcDispositionStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_location_id")
    public MatFlowLocation targetLocation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_reservation_id")
    public MatFlowReservation generatedReservation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_transfer_id")
    public MatFlowTransferOrder generatedTransfer;

    @Column(name = "disposition_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal dispositionQty;

    @Column(name = "decided_by", nullable = false, length = 150)
    public String decidedBy;

    @Column(name = "decided_at", nullable = false)
    public LocalDateTime decidedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}
