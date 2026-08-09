package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "mf_purchase_orders", uniqueConstraints = @UniqueConstraint(name = "uk_mf_po_number", columnNames = "po_number"), indexes = {
                @Index(name = "idx_mf_po_vendor", columnList = "vendor_id"),
                @Index(name = "idx_mf_po_indent", columnList = "indent_id"),
                @Index(name = "idx_mf_po_status", columnList = "status")
})
public class MatFlowPurchaseOrder extends MatFlowBaseEntity {
        @Column(name = "po_number", nullable = false, length = 150)
        public String poNumber;
        @Column(name = "po_date", nullable = false)
        public LocalDate poDate;
        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "vendor_id", nullable = false)
        public MatFlowVendor vendor;
        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "indent_id", nullable = false)
        public MatFlowIndent indent;
        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "delivery_location_id", nullable = false)
        public MatFlowLocation deliveryLocation;
        @Enumerated(EnumType.STRING)
        @Column(name = "status", nullable = false, length = 50)
        public PurchaseOrderStatus status = PurchaseOrderStatus.DRAFT;
        @Column(name = "approved_by", length = 150)
        public String approvedBy;
        @Column(name = "approved_at")
        public LocalDateTime approvedAt;
        @Column(name = "approval_remarks", columnDefinition = "text")
        public String approvalRemarks;
        @Column(name = "remarks", columnDefinition = "text")
        public String remarks;
}
