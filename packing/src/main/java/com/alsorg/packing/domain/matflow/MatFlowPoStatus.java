package com.alsorg.packing.domain.matflow;

public enum MatFlowPoStatus {

    /**
     * Purchase is preparing the PO.
     */
    DRAFT,

    /**
     * PO has been submitted for approval.
     */
    PENDING_APPROVAL,

    /**
     * Approver approved the PO.
     */
    APPROVED,

    /**
     * Approver returned the PO to Purchase.
     */
    RETURNED,

    /**
     * Approved PO has been placed with the vendor.
     */
    ORDER_PLACED,

    /**
     * Vendor supplied part of the ordered quantity.
     */
    PARTIALLY_RECEIVED,

    /**
     * Complete ordered quantity has been received.
     */
    FULLY_RECEIVED,

    /**
     * PO was cancelled.
     */
    CANCELLED,

    /**
     * PO, receipts, QC and commercial actions are complete.
     */
    CLOSED
}