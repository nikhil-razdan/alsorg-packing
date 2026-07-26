package com.alsorg.packing.domain.venflow;

public enum VenFlowPoVerificationStatus {

    /**
     * Waiting for Director decision.
     */
    PENDING,

    /**
     * Director approved the exact submitted snapshot.
     */
    APPROVED,

    /**
     * Director returned the snapshot to Purchase.
     */
    RETURNED,

    /**
     * A newer snapshot replaced this one.
     */
    SUPERSEDED,

    /**
     * Verification was cancelled.
     */
    CANCELLED
}