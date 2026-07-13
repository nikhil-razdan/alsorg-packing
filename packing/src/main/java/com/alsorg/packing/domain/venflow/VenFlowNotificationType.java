package com.alsorg.packing.domain.venflow;

public enum VenFlowNotificationType {

    /*
     * General workflow movement visible to Director/Admin.
     */
    ACTIVITY,

    /*
     * Purchase and Director approval.
     */
    PO_APPROVAL_REQUIRED,
    PO_APPROVED,
    PO_REJECTED,

    /*
     * Vendor-order tracking.
     */
    VENDOR_ORDER_PENDING,
    VENDOR_ORDER_PLACED,
    VENDOR_DELAYED,

    /*
     * Overall material and stage-delay tracking.
     */
    MATERIAL_DELAYED,
    STAGE_SLA_BREACHED,

    /*
     * Store and production events.
     */
    MATERIAL_RECEIVED,
    QC_FAILED,
    PROCESS_COMPLETED,
    SUPERVISOR_CLOSURE_PENDING
}