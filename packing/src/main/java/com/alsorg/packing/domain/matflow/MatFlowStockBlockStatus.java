package com.alsorg.packing.domain.matflow;

public enum MatFlowStockBlockStatus {

    /*
     * Stock remains reserved against the requisition line.
     */
    ACTIVE,

    /*
     * Some of the reserved stock has been issued.
     */
    PARTIALLY_ISSUED,

    /*
     * All reserved stock has been issued.
     */
    FULLY_ISSUED,

    /*
     * Reservation was intentionally released.
     */
    RELEASED,

    /*
     * Reservation was cancelled because the requisition was
     * returned or cancelled.
     */
    CANCELLED
}