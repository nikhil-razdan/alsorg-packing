package com.alsorg.packing.domain.matflow;

public enum MatFlowRequisitionLineStatus {
    DRAFT,
    STORE_REVIEW_PENDING,
    PARTIALLY_BLOCKED,
    STOCK_BLOCKED,
    SHORTAGE_IDENTIFIED,
    PARTIALLY_ISSUED,
    ISSUED,
    CANCELLED
}