package com.alsorg.packing.bomflow.domain;

/**
 * Revision status used by the current BOM Builder workflow.
 *
 * The additional legacy values are retained only so pre-existing rows in
 * bom_flow_revisions can be deserialized without an Enum mapping failure.
 * Current workflow transitions are still DRAFT -> SUBMITTED -> VERIFIED ->
 * APPROVED, with RETURNED for correction.
 */
public enum BomFlowRevisionStatus {
    DRAFT,
    SUBMITTED,
    VERIFIED,
    RETURNED,
    APPROVED,

    // Legacy bom_flow_revisions values retained for backward-compatible reads.
    PENDING_ENGINEERING_APPROVAL,
    RELEASED,
    SUPERSEDED,
    CANCELLED
}
