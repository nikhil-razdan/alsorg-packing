package com.alsorg.packing.domain.matflow;

public final class MatFlowPlanningTypes {

    private MatFlowPlanningTypes() {
    }

    public enum LocationType {

        STORE,

        PRODUCTION,

        PROCESSING,

        QC,

        TRANSIT,

        EXTERNAL_PROCESSOR,

        SUPPLIER
    }

    public enum OwnershipType {

        INTERNAL,

        EXTERNAL
    }

    public enum RouteStepType {

        PROCESSING,

        QC,

        PRODUCTION
    }

    public enum MovementType {

        OPENING_BALANCE,

        ADJUSTMENT_IN,

        ADJUSTMENT_OUT,

        RESERVE,

        RELEASE_RESERVATION,

        RECEIPT,

        TRANSFER_OUT,

        TRANSFER_RECEIPT_CLEAR,

        TRANSFER_IN,

        PROCESS_CONSUMPTION,

        PROCESS_OUTPUT,

        ISSUE_TO_PRODUCTION,

        RETURN_TO_STORE,

        QC_HOLD,

        QC_RELEASE,

        RETURN_TO_VENDOR,

        PROCESS_WASTAGE,

        PRODUCTION_CONSUMPTION,

        MATERIAL_RETURN_OUT,

        MATERIAL_RETURN_RECEIPT_CLEAR,

        MATERIAL_RETURN_IN,

        QC_REWORK_RELEASE,

        SCRAP
    }

    public enum RequisitionStatus {

        DRAFT,
        SUBMITTED_TO_STORE,
        STORE_REVIEW_IN_PROGRESS,
        PARTIALLY_RESERVED,
        SHORTAGE_PENDING,
        READY_TO_ISSUE,
        PARTIALLY_ISSUED,
        ISSUED_TO_PRODUCTION,
        PRODUCTION_STARTED,
        PRODUCTION_COMPLETED,
        CANCELLED,
        /*
         * Legacy values retained temporarily so existing database
         * records continue to deserialize during migration.
         */
        SUBMITTED,
        PLANNED,
        ISSUED,
        COMPLETED
    }

    public enum RequisitionLineStatus {

        PENDING_STORE_REVIEW,

        RESERVED,

        PARTIALLY_RESERVED,

        SHORTAGE_IDENTIFIED,

        INDENT_CREATED,

        ORDERED,

        QC_PENDING,

        READY_TO_ISSUE,

        PROCESSING_REQUIRED,

        IN_PROCESSING,

        PARTIALLY_ISSUED,

        ISSUED_TO_PRODUCTION,

        PARTIALLY_CONSUMED,

        CONSUMED,

        RETURNED,

        CANCELLED
    }

    public enum ReservationStatus {

        ACTIVE,

        PARTIALLY_ISSUED,

        ISSUED,

        RELEASED,

        CANCELLED
    }

    public enum IndentStatus {

        AUTO_CREATED,
        DRAFT,

        SUBMITTED_TO_PURCHASE,
        PURCHASE_IN_PROGRESS,
        PO_CREATED,

        PARTIALLY_RECEIVED,
        RECEIVED,

        RETURNED,
        CANCELLED
    }

    public enum TransferStatus {

        PLANNED,

        READY,

        PARTIALLY_DISPATCHED,

        IN_TRANSIT,

        PARTIALLY_RECEIVED,

        RECEIVED,

        CANCELLED
    }

    public enum TransferPurpose {

        STORE_TO_PROCESSING,

        PROCESSING_TO_PROCESSING,

        PROCESSING_TO_PRODUCTION,

        STORE_TO_PRODUCTION,

        INTER_PLANT,

        QC_TRANSFER,

        QC_TO_REWORK,

        RETURN_TO_SOURCE,

        PRODUCTION_RETURN
    }

    public enum PurchaseOrderStatus {

        DRAFT,

        PLACED,

        PARTIALLY_RECEIVED,

        RECEIVED,

        CANCELLED
    }

    public enum GoodsReceiptStatus {

        QC_PENDING,

        PARTIALLY_ACCEPTED,

        ACCEPTED,

        REJECTED,

        CLOSED
    }

    public enum QcInspectionStatus {

        PENDING,

        COMPLETED,

        CANCELLED
    }

    public enum QcSourceType {

        GOODS_RECEIPT,

        TRANSFER_RECEIPT
    }

    public enum VendorReturnStatus {

        DRAFT,

        DISPATCHED,

        CLOSED,

        CANCELLED
    }

    public enum ProcessingJobStatus {

        PENDING,

        IN_PROGRESS,

        COMPLETED,

        CANCELLED
    }

    public enum MaterialReturnStatus {

        DRAFT,

        IN_TRANSIT,

        PARTIALLY_RECEIVED,

        RECEIVED,

        CANCELLED
    }

    public enum MaterialReturnReason {

        UNUSED,

        EXCESS,

        WRONG_MATERIAL,

        DAMAGED,

        PROCESS_REJECTED,

        QC_REJECTED,

        OTHER
    }

    public enum QcDispositionType {

        HOLD,

        REWORK,

        RETURN_TO_SOURCE,

        SCRAP
    }

    public enum QcDispositionStatus {

        OPEN,

        TRANSFER_CREATED,

        COMPLETED,

        CANCELLED
    }
}