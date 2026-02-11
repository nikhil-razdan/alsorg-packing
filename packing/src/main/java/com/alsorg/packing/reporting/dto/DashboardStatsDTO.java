package com.alsorg.packing.reporting.dto;

public class DashboardStatsDTO {

    private long totalItems;
    private long packedItems;
    private long dispatchedItems;
    private long inventoryItems;   // ✅ NEW
    private long stickersGenerated;

    public DashboardStatsDTO() {}

    public DashboardStatsDTO(
            long totalItems,
            long packedItems,
            long dispatchedItems,
            long inventoryItems,
            long stickersGenerated
    ) {
        this.totalItems = totalItems;
        this.packedItems = packedItems;
        this.dispatchedItems = dispatchedItems;
        this.inventoryItems = inventoryItems;
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

    public long getInventoryItems() {
        return inventoryItems;
    }

    public long getStickersGenerated() {
        return stickersGenerated;
    }
}
