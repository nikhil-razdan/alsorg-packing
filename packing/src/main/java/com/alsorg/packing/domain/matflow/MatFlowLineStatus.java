package com.alsorg.packing.domain.matflow;

/**
 * Aggregate lifecycle of one released MatFlow material line.
 *
 * This status belongs to the released BOM material line and describes
 * how much of its demand has been requisitioned, blocked, indented,
 * procured, received and issued.
 */
public enum MatFlowLineStatus {

    /**
     * No Production requisition has committed demand against this line.
     */
    NOT_REQUISITIONED,

    /**
     * Only part of the released quantity has been requisitioned.
     */
    PARTIALLY_REQUISITIONED,

    /**
     * The complete released quantity has been requisitioned.
     */
    REQUISITIONED,

    /**
     * A submitted Production requisition is waiting for Store review.
     */
    STORE_REVIEW_PENDING,

    /**
     * Store has blocked part of the requisitioned quantity.
     */
    PARTIALLY_BLOCKED,

    /**
     * Store has blocked the complete requisitioned quantity.
     */
    FULLY_BLOCKED,

    /**
     * Store identified a material shortage.
     */
    SHORTAGE_IDENTIFIED,

    /**
     * Only part of the current shortage has been included in submitted
     * or active material indents.
     */
    PARTIALLY_INDENTED,

    /**
     * The complete current shortage has been covered by material indents.
     */
    INDENT_RAISED,

    /**
     * Purchase processing has started.
     */
    PROCUREMENT_IN_PROGRESS,

    /**
     * Only part of the ordered material has been received.
     */
    PARTIALLY_RECEIVED,

    /**
     * Received material is waiting for inspection.
     */
    INSPECTION_PENDING,

    /**
     * Some material is available for issue, but the complete required
     * quantity is not yet available.
     */
    PARTIALLY_AVAILABLE_FOR_ISSUE,

    /**
     * The complete required quantity is available for issue.
     */
    READY_FOR_ISSUE,

    /**
     * Some material has been issued to Production.
     */
    PARTIALLY_ISSUED,

    /**
     * The complete required quantity has been issued to Production.
     */
    FULLY_ISSUED,

    /**
     * Processing has been placed on hold.
     */
    ON_HOLD,

    /**
     * The released material line was cancelled.
     */
    CANCELLED
}