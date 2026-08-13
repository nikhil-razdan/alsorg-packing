package com.alsorg.packing.domain.matflow;

/**
 * Durable BOM revision/history actions.
 * Legacy approval constants remain only so historical database rows
 * deserialize.
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

    /** Active final operational BOM gate performed by Production. */
    PRODUCTION_REVIEWED,

    /** @deprecated old name for historical BOM history rows. */
    @Deprecated
    PRODUCTION_APPROVED,

    PRODUCTION_RETURNED,

    /**
     * @deprecated historical compatibility only; no Director BOM approval gate
     *             exists.
     */
    @Deprecated
    DIRECTOR_APPROVED,

    /**
     * @deprecated historical compatibility only; no Director BOM approval gate
     *             exists.
     */
    @Deprecated
    DIRECTOR_RETURNED,

    REVISION_CREATED,
    SUPERSEDED
}
