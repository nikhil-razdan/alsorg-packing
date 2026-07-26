package com.alsorg.packing.domain.matflow;

public enum MatFlowStockSourceType {

    /*
     * Quantity must be verified through the connected inventory
     * system. This remains disabled until the real inventory
     * adapter is connected.
     */
    SYSTEM_INVENTORY,

    /*
     * Store verifies physical or offline stock manually.
     */
    OFFLINE_MANUAL
}