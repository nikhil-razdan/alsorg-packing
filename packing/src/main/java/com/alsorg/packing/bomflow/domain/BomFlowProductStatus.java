package com.alsorg.packing.bomflow.domain;

/**
 * Product/header status for BOMFlow.
 *
 * ACTIVE/ARCHIVED are used by the current Product Master flow. The legacy
 * BOMFlow values are intentionally retained so existing rows in
 * bom_flow_boms can still be read safely after the Product Master backend is
 * introduced. New Product Master records continue to start as DRAFT.
 */
public enum BomFlowProductStatus {
    DRAFT,
    ACTIVE,
    ARCHIVED,

    // Legacy bom_flow_boms values retained for backward-compatible reads.
    PENDING_ENGINEERING_APPROVAL,
    APPROVED,
    RELEASED,
    RETURNED,
    SUPERSEDED,
    CANCELLED
}
