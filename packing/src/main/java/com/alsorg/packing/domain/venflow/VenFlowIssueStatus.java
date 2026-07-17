package com.alsorg.packing.domain.venflow;

public enum VenFlowIssueStatus {
    /*
     * Legacy values.
     */
    NOT_RESERVED,
    RESERVED,

    /*
     * New QC-controlled flow.
     */
    NOT_READY,
    READY_FOR_ISSUE,
    PARTIALLY_ISSUED,

    ISSUED
}