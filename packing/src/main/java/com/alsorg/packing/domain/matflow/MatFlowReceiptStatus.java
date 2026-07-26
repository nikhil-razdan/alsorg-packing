package com.alsorg.packing.domain.matflow;

public enum MatFlowReceiptStatus {

    /**
     * Receipt is being prepared.
     */
    DRAFT,

    /**
     * Material has physically arrived at Store.
     */
    RECEIVED,

    /**
     * GRN has been completed for this receipt.
     */
    GRN_COMPLETED,

    /**
     * Receipt lines are waiting for QC.
     */
    INSPECTION_PENDING,

    /**
     * Some but not all receipt quantity has been inspected.
     */
    PARTIALLY_INSPECTED,

    /**
     * Complete receipt quantity has been inspected.
     */
    INSPECTED,

    /**
     * Receipt was cancelled before final processing.
     */
    CANCELLED
}