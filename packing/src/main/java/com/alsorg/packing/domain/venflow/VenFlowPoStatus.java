package com.alsorg.packing.domain.venflow;

public enum VenFlowPoStatus {

    /*
     * Initial state.
     */
    NOT_RAISED,

    /*
     * Legacy compatibility.
     * Keep these while old database rows or old API flows may still use them.
     */
    RAISED,
    APPROVED,

    /*
     * Current Director approval workflow.
     */
    PENDING_DIRECTOR_APPROVAL,
    DIRECTOR_APPROVED,
    DIRECTOR_REJECTED,
    ORDER_PLACED
}