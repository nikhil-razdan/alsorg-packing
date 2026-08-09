package com.alsorg.packing.domain.matflow;

public enum MatFlowBomStatus {
    DRAFT,
    SUBMITTED,
    /**
     * @deprecated historical database compatibility only; new workflow submits
     *             directly to Production.
     */
    @Deprecated
    PRODUCTION_REVIEW_PENDING,
    RETURNED,
    APPROVED,
    SUPERSEDED
}
