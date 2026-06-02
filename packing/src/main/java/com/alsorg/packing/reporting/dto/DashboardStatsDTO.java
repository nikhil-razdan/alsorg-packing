package com.alsorg.packing.reporting.dto;

public class DashboardStatsDTO {

    private long totalItems;

    private long warehouseItems;
    private long readyToDispatchItems;
    private long readyItems;

    private long packedItems;
    private long dispatchedItems;
    private long pendingItems;
    private long stickersGenerated;

    private long todayStickerGenerated;
    private long todayChallanGenerated;

    public DashboardStatsDTO() {}

    public DashboardStatsDTO(
            long totalItems,
            long warehouseItems,
            long readyToDispatchItems,
            long readyItems,
            long packedItems,
            long dispatchedItems,
            long pendingItems,
            long stickersGenerated,
            long todayStickerGenerated,
            long todayChallanGenerated
    ) {
        this.totalItems = totalItems;
        this.warehouseItems = warehouseItems;
        this.readyToDispatchItems = readyToDispatchItems;
        this.readyItems = readyItems;
        this.packedItems = packedItems;
        this.dispatchedItems = dispatchedItems;
        this.pendingItems = pendingItems;
        this.stickersGenerated = stickersGenerated;
        this.todayStickerGenerated = todayStickerGenerated;
        this.todayChallanGenerated = todayChallanGenerated;
    }

    public long getTotalItems() {
        return totalItems;
    }

    public long getWarehouseItems() {
        return warehouseItems;
    }

    public long getReadyToDispatchItems() {
        return readyToDispatchItems;
    }

    public long getReadyItems() {
        return readyItems;
    }

    public long getPackedItems() {
        return packedItems;
    }

    public long getDispatchedItems() {
        return dispatchedItems;
    }

    public long getPendingItems() {
        return pendingItems;
    }

    public long getStickersGenerated() {
        return stickersGenerated;
    }

    public long getTodayStickerGenerated() {
        return todayStickerGenerated;
    }

    public long getTodayChallanGenerated() {
        return todayChallanGenerated;
    }
}