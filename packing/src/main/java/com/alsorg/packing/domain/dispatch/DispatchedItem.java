package com.alsorg.packing.domain.dispatch;

import java.time.LocalDateTime;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import jakarta.persistence.*;

@Entity
@Table(name = "dispatched_items")
public class DispatchedItem {

    @Id
    @Column(name = "zoho_item_id", nullable = false)
    private String zohoItemId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = true)
    private String sku;

    @Column(name = "client_name")
    private String clientName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItemDispatchStatus status;

    @Column(name = "packed_at")
    private LocalDateTime packedAt;

    @Column(nullable = false)
    private Integer stock = 0; // 🔥 default to avoid null violations

    /* ===================== RESTORE / APPROVAL ===================== */

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status")
    private ApprovalStatus approvalStatus;

    @Column(name = "approval_requested_by")
    private String approvalRequestedBy;

    @Column(name = "approval_requested_at")
    private LocalDateTime approvalRequestedAt;
    
    private String packedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "restore_requested", nullable = false)
    private boolean restoreRequested = false;

    @Column(name = "requested_by")
    private String requestedBy;

    @Column(name = "requested_at")
    private LocalDateTime requestedAt;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    /* ===================== DISPATCH ===================== */

    @Column(name = "dispatched_by")
    private String dispatchedBy;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    public DispatchedItem() {
    }

    /* ===================== GETTERS / SETTERS ===================== */

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public ItemDispatchStatus getStatus() {
        return status;
    }

    public void setStatus(ItemDispatchStatus status) {
        this.status = status;
    }

    public LocalDateTime getPackedAt() {
        return packedAt;
    }

    public void setPackedAt(LocalDateTime packedAt) {
        this.packedAt = packedAt;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }

    public ApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(ApprovalStatus approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public String getApprovalRequestedBy() {
        return approvalRequestedBy;
    }

    public void setApprovalRequestedBy(String approvalRequestedBy) {
        this.approvalRequestedBy = approvalRequestedBy;
    }

    public LocalDateTime getApprovalRequestedAt() {
        return approvalRequestedAt;
    }

    public void setApprovalRequestedAt(LocalDateTime approvalRequestedAt) {
        this.approvalRequestedAt = approvalRequestedAt;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public boolean isRestoreRequested() {
        return restoreRequested;
    }

    public void setRestoreRequested(boolean restoreRequested) {
        this.restoreRequested = restoreRequested;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(LocalDateTime requestedAt) {
        this.requestedAt = requestedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getDispatchedBy() {
        return dispatchedBy;
    }

    public void setDispatchedBy(String dispatchedBy) {
        this.dispatchedBy = dispatchedBy;
    }

    public LocalDateTime getDispatchedAt() {
        return dispatchedAt;
    }

    public void setDispatchedAt(LocalDateTime dispatchedAt) {
        this.dispatchedAt = dispatchedAt;
    }

	public String getPackedBy() {
		return packedBy;
	}

	public void setPackedBy(String packedBy) {
		this.packedBy = packedBy;
	}
}
