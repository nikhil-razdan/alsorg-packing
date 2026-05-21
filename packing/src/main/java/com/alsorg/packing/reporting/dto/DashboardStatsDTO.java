package com.alsorg.packing.reporting.dto;

public class DashboardStatsDTO {

    private long totalItems;
    private long packedItems;
    private long dispatchedItems;
    private long pendingItems;   // ✅ NEW
    private long stickersGenerated;

    public DashboardStatsDTO() {}

    public DashboardStatsDTO(
            long totalItems,
            long packedItems,
            long dispatchedItems,
            long pendingItems,
            long stickersGenerated
    ) {
        this.totalItems = totalItems;
        this.packedItems = packedItems;
        this.dispatchedItems = dispatchedItems;
        this.pendingItems = pendingItems;
        this.stickersGenerated = stickersGenerated;
    }

    public long getTotalItems() {
        return totalItems;
    }

    public long getPackedItems() {
        return packedItems;
    }

    public long getDispatchedItems() {
        return dispatchedItems;
    }

    public long getPendingItems(){
        return pendingItems;
    }

    public long getStickersGenerated() {
        return stickersGenerated;
    }
}
