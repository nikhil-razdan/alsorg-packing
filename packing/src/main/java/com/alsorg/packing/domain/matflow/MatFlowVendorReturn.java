package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.VendorReturnStatus;

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
@Table(name = "mf_vendor_returns", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_vendor_return_number", columnNames = "return_number")
}, indexes = {
        @Index(name = "idx_mf_vendor_return_qc", columnList = "qc_inspection_id"),
        @Index(name = "idx_mf_vendor_return_status", columnList = "status")
})
public class MatFlowVendorReturn
        extends MatFlowBaseEntity {

    @Column(name = "return_number", nullable = false, length = 150)
    public String returnNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "qc_inspection_id", nullable = false)
    public MatFlowQcInspection qcInspection;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vendor_id", nullable = false)
    public MatFlowVendor vendor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    public MatFlowMaterial material;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_location_id", nullable = false)
    public MatFlowLocation fromLocation;

    @Column(name = "return_qty", nullable = false, precision = 19, scale = 3)
    public BigDecimal returnQty;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    public VendorReturnStatus status = VendorReturnStatus.DRAFT;

    @Column(name = "dispatched_by", length = 150)
    public String dispatchedBy;

    @Column(name = "dispatched_at")
    public LocalDateTime dispatchedAt;

    @Column(name = "remarks", columnDefinition = "text")
    public String remarks;
}