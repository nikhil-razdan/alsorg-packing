package com.alsorg.packing.bomflow.domain;

/**
 * Product/header status for BOMFlow.
 *
 * ACTIVE/ARCHIVED are used by the current Product Master flow. Legacy values
 * are retained so existing bom_flow_boms rows remain readable.
 */
public enum BomFlowProductStatus {
    DRAFT,
    ACTIVE,
    ARCHIVED,
    PENDING_ENGINEERING_APPROVAL,
    APPROVED,
    RELEASED,
    RETURNED,
    SUPERSEDED,
    CANCELLED
}
