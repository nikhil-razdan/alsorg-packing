package com.alsorg.packing.domain.matflow;

/**
 * Durable BOM revision/history actions.
 * Legacy HOD values are retained only so historical rows can still deserialize.
 */
public enum MatFlowApprovalAction {
    CREATED,
    UPDATED,
    LINE_ADDED,
    LINE_UPDATED,
    LINE_REMOVED,
    SUBMITTED,

    /** @deprecated historical compatibility only. */
    @Deprecated
    HOD_APPROVED,
    /** @deprecated historical compatibility only. */
    @Deprecated
    HOD_RETURNED,

    PRODUCTION_APPROVED,
    PRODUCTION_RETURNED,
    DIRECTOR_APPROVED,
    DIRECTOR_RETURNED,
    REVISION_CREATED,
    SUPERSEDED
}
