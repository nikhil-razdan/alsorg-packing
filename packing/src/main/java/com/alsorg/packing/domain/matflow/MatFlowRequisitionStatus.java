package com.alsorg.packing.domain.matflow;

public enum MatFlowRequisitionStatus {
    DRAFT,
    STORE_REVIEW_PENDING,
    PARTIALLY_BLOCKED,
    FULLY_BLOCKED,
    SHORTAGE_IDENTIFIED,
    PARTIALLY_ISSUED,
    ISSUED,
    RETURNED,
    CANCELLED
}