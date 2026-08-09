package com.alsorg.packing.domain.matflow;

public enum MatFlowApprovalAction {
    CREATED, UPDATED, LINE_ADDED, LINE_UPDATED, LINE_REMOVED, SUBMITTED, RETURNED, APPROVED,
    /**
     * @deprecated historical audit compatibility only; HOD is not part of the
     *             active workflow.
     */
    @Deprecated
    HOD_APPROVED,
    PRODUCTION_APPROVED, PRODUCTION_RETURNED, REVISION_CREATED, SUPERSEDED
}
