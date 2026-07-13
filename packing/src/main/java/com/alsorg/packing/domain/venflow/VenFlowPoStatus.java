package com.alsorg.packing.domain.venflow;

public enum VenFlowPoStatus {

    NOT_RAISED,

    /*
     * Purchase prepared the PO and submitted it to Director.
     */
    PENDING_DIRECTOR_APPROVAL,

    /*
     * Director approved the PO.
     * Purchase must still place the order with the vendor.
     */
    DIRECTOR_APPROVED,

    /*
     * Director rejected / returned the PO for correction.
     */
    DIRECTOR_REJECTED,

    /*
     * Purchase sent the approved PO/order to the vendor.
     */
    ORDER_PLACED,

    CANCELLED,

    /*
     * Legacy compatibility only.
     */
    RAISED,
    APPROVED,
    REJECTED
}