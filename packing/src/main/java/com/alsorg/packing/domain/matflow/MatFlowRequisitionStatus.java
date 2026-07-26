package com.alsorg.packing.domain.matflow;

/**
 * Overall lifecycle of a Production material requisition.
 *
 * A requisition is created by Production and then submitted to
 * Store for stock review, blocking and shortage identification.
 */
public enum MatFlowRequisitionStatus {

    /**
     * Production is still preparing the requisition.
     */
    DRAFT,

    /**
     * Production has submitted the requisition to Store.
     */
    SUBMITTED_TO_STORE,

    /**
     * Compatibility status for records created with the earlier
     * MatFlow workflow terminology.
     */
    STORE_REVIEW_PENDING,

    /**
     * Store has started reviewing one or more requisition lines,
     * but the complete requisition has not yet been finalized.
     */
    STORE_REVIEW_IN_PROGRESS,

    /**
     * Store has reviewed every active requisition line.
     *
     * Individual lines may still contain blocked quantities,
     * shortages or quantities awaiting an indent.
     */
    STORE_REVIEW_COMPLETED,

    /**
     * Store could block only part of the requested quantity.
     */
    PARTIALLY_BLOCKED,

    /**
     * Store blocked the complete requested quantity.
     */
    FULLY_BLOCKED,

    /**
     * One or more requisition lines contain a shortage.
     */
    SHORTAGE_IDENTIFIED,

    /**
     * Some quantity has been issued to Production.
     */
    PARTIALLY_ISSUED,

    /**
     * The complete approved quantity has been issued.
     */
    ISSUED,

    /**
     * Requisition was returned for correction.
     */
    RETURNED,

    /**
     * Requisition was cancelled.
     */
    CANCELLED
}