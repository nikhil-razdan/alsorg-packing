package com.alsorg.packing.domain.matflow;

public enum MatFlowStoreDecision {

    /*
     * Entire requested quantity is available and blocked.
     */
    AVAILABLE,

    /*
     * Some quantity is blocked and the balance is a shortage.
     */
    PARTIALLY_AVAILABLE,

    /*
     * No quantity is available to block.
     */
    NOT_AVAILABLE,

    /*
     * Store cannot complete the review until clarification or
     * another operational issue is resolved.
     */
    HOLD
}