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

        SUBMITTED,

        PLANNED,

        SHORTAGE_PENDING,

        ISSUED,

        COMPLETED,

        CANCELLED
    }

    public enum ReservationStatus {

        ACTIVE,

        RELEASED,

        ISSUED,

        CANCELLED
    }

    public enum IndentStatus {

        AUTO_CREATED,

        SUBMITTED,

        ORDERED,

        PARTIALLY_RECEIVED,

        RECEIVED,

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