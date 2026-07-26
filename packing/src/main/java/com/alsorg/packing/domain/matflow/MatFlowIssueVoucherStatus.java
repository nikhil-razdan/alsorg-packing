package com.alsorg.packing.domain.matflow;

public enum MatFlowIssueVoucherStatus {

    /**
     * Voucher is being prepared and can still be edited.
     */
    DRAFT,

    /**
     * Material has been issued by Store.
     */
    ISSUED,

    /**
     * Production has acknowledged receiving the material.
     */
    ACKNOWLEDGED,

    /**
     * Voucher was cancelled before acknowledgement.
     */
    CANCELLED
}