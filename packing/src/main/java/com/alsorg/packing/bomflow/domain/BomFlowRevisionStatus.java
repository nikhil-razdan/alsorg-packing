package com.alsorg.packing.bomflow.domain;

/**
 * Revision status used by the current BOM Builder workflow.
 *
 * Legacy values remain for backwards-compatible reads. Current workflow remains
 * DRAFT -> SUBMITTED -> VERIFIED -> APPROVED, with RETURNED for correction.
 */
public enum BomFlowRevisionStatus {
    DRAFT,
    SUBMITTED,
    VERIFIED,
    RETURNED,
    APPROVED,
    PENDING_ENGINEERING_APPROVAL,
    RELEASED,
    SUPERSEDED,
    CANCELLED
}
