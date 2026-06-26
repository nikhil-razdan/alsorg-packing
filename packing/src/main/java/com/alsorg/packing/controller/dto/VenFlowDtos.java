package com.alsorg.packing.controller.dto;

import com.alsorg.packing.domain.venflow.VenFlowStoreStatus;
import com.alsorg.packing.domain.venflow.VenFlowUnit;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class VenFlowDtos {

    private VenFlowDtos() {
    }

    /*
     * Production raises veneer requirement.
     * Plant is mandatory because entries are plant-wise/access-wise.
     */
    public record CreateRequest(
            String plantCode,
            LocalDate orderDate,
            String pdNo,
            String clientName,
            String bomReference,
            String bomAttachmentUrl
    ) {
    }

    public record ProductDetailsRequest(
            String productDescription,
            String veneerType,
            String size
    ) {
    }

    public record StoreStatusRequest(
            VenFlowStoreStatus storeStatus
    ) {
    }

    public record RequisitionRequest(
            String requisitionSlipNo,
            LocalDate requisitionDate
    ) {
    }

    public record OrderedQtyRequest(
            BigDecimal orderedQty,
            VenFlowUnit unit
    ) {
    }

    public record ExpectedDateRequest(
            LocalDate expectedDate
    ) {
    }

    /*
     * Keep old received endpoint compatible.
     */
    public record ReceivedQtyRequest(
            BigDecimal receivedQty,
            LocalDate actualInHouseDate
    ) {
    }

    /*
     * New material receiving endpoint.
     * Same data as receivedQty, but with remarks.
     */
    public record MaterialReceivedRequest(
            BigDecimal receivedQty,
            LocalDate actualInHouseDate,
            String remarks
    ) {
    }

    /*
     * Purchase department PO entry.
     */
    public record PoRequest(
            String vendorName,
            String poNo,
            LocalDate poDate,
            BigDecimal poAmount,
            String poDocumentUrl,
            String remarks
    ) {
    }

    /*
     * Production start / job done request.
     */
    public record ProductionActionRequest(
            String remarks
    ) {
    }

    public record RemarksRequest(
            String remarks
    ) {
    }

    /*
     * Keep old dashboard fields and add new fields.
     * This avoids breaking old frontend immediately.
     */
    public record DashboardResponse(
            long totalEntries,

            long pendingStoreCheck,
            long pendingRequisition,
            long pendingOrderQty,
            long pendingReceiving,
            long balancePending,
            long delayedItems,
            long completedEntries,

            long sentToPurchase,
            long pendingPoRaise,
            long pendingPoApproval,
            long pendingMaterialReceiving,
            long materialReceivedNotInformed,
            long productionNotStarted,
            long productionStarted,
            long jobDone,
            long totalPendingWorkLoading
    ) {
    }

    /*
     * Reports page summary.
     */
    public record ReportSummaryResponse(
            long totalOrders,
            long pendingStoreCheck,
            long sentToPurchase,
            long pendingPoRaise,
            long pendingPoApproval,
            long pendingMaterialReceiving,
            long materialReceivedNotInformed,
            long productionNotStarted,
            long productionStarted,
            long jobDone,
            long delayedItems,
            long totalPendingWorkLoading
    ) {
    }
}