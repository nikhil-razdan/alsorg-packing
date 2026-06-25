package com.alsorg.packing.controller.dto;

import com.alsorg.packing.domain.venflow.VenFlowStoreStatus;
import com.alsorg.packing.domain.venflow.VenFlowUnit;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class VenFlowDtos {

    private VenFlowDtos() {
    }

    public record CreateRequest(
            LocalDate orderDate,
            String pdNo,
            String clientName
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

    public record ReceivedQtyRequest(
            BigDecimal receivedQty,
            LocalDate actualInHouseDate
    ) {
    }

    public record RemarksRequest(
            String remarks
    ) {
    }

    public record DashboardResponse(
            long totalEntries,
            long pendingStoreCheck,
            long pendingRequisition,
            long pendingOrderQty,
            long pendingReceiving,
            long balancePending,
            long delayedItems,
            long completedEntries
    ) {
    }
}