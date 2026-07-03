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

  
    private long masterItems;
    private long totalPackets;
    private long packetItems;

    private long fullyPackedMasterItems;
    private long partiallyPackedMasterItems;
    private long unpackedMasterItems;

    private long packedPackets;
    private long pendingPackets;

    private long packetItemsWithSticker;
    private long packetItemsPendingSticker;
    private long stickerReprints;

    /*
     * DISPATCH / WAREHOUSE FIELDS
     */
    private long readyToStoreItems;
    private long warehouseRequestedItems;
    private long returnRequestedItems;
    private long queuedItems;

    private long pkdItems;
    private long fgItems;

    private long normalDispatchChallans;
    private long todayDispatchChallans;
    private long runningTrips;
    private long endedTrips;

    /*
     * CUSTOM CHALLANS
     */
    private long customChallans;
    private long todayCustomChallans;
    private long customChallanItems;

    /*
     * LOGISTICS MASTER
     */
    private long activeDrivers;
    private long activeVehicles;
    private long expiredFitness;
    private long expiredInsurance;
    private long expiredPucc;

    /*
     * DATA EXCEPTIONS
     */
    private long exceptionsCount;
    private long masterItemsWithoutPackets;
    private long packetsWithoutPacketItems;
    private long packetItemsWithoutMaster;
    private long dispatchedWithoutPacketItem;
    private long dispatchedWithoutChallan;
    private long dispatchedWithoutDriver;
    private long duplicateCurrentStickers;
    private long readyItemsStillInPkd;

    public DashboardStatsDTO() {
    }

    /*
     * OLD CONSTRUCTOR - keep this because old code may still call it.
     */
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

    public void setTotalItems(long totalItems) {
        this.totalItems = totalItems;
    }

    public long getWarehouseItems() {
        return warehouseItems;
    }

    public void setWarehouseItems(long warehouseItems) {
        this.warehouseItems = warehouseItems;
    }

    public long getReadyToDispatchItems() {
        return readyToDispatchItems;
    }

    public void setReadyToDispatchItems(long readyToDispatchItems) {
        this.readyToDispatchItems = readyToDispatchItems;
    }

    public long getReadyItems() {
        return readyItems;
    }

    public void setReadyItems(long readyItems) {
        this.readyItems = readyItems;
    }

    public long getPackedItems() {
        return packedItems;
    }

    public void setPackedItems(long packedItems) {
        this.packedItems = packedItems;
    }

    public long getDispatchedItems() {
        return dispatchedItems;
    }

    public void setDispatchedItems(long dispatchedItems) {
        this.dispatchedItems = dispatchedItems;
    }

    public long getPendingItems() {
        return pendingItems;
    }

    public void setPendingItems(long pendingItems) {
        this.pendingItems = pendingItems;
    }

    public long getStickersGenerated() {
        return stickersGenerated;
    }

    public void setStickersGenerated(long stickersGenerated) {
        this.stickersGenerated = stickersGenerated;
    }

    public long getTodayStickerGenerated() {
        return todayStickerGenerated;
    }

    public void setTodayStickerGenerated(long todayStickerGenerated) {
        this.todayStickerGenerated = todayStickerGenerated;
    }

    public long getTodayChallanGenerated() {
        return todayChallanGenerated;
    }

    public void setTodayChallanGenerated(long todayChallanGenerated) {
        this.todayChallanGenerated = todayChallanGenerated;
    }

    public long getMasterItems() {
        return masterItems;
    }

    public void setMasterItems(long masterItems) {
        this.masterItems = masterItems;
    }

    public long getTotalPackets() {
        return totalPackets;
    }

    public void setTotalPackets(long totalPackets) {
        this.totalPackets = totalPackets;
    }

    public long getPacketItems() {
        return packetItems;
    }

    public void setPacketItems(long packetItems) {
        this.packetItems = packetItems;
    }

    public long getFullyPackedMasterItems() {
        return fullyPackedMasterItems;
    }

    public void setFullyPackedMasterItems(long fullyPackedMasterItems) {
        this.fullyPackedMasterItems = fullyPackedMasterItems;
    }

    public long getPartiallyPackedMasterItems() {
        return partiallyPackedMasterItems;
    }

    public void setPartiallyPackedMasterItems(long partiallyPackedMasterItems) {
        this.partiallyPackedMasterItems = partiallyPackedMasterItems;
    }

    public long getUnpackedMasterItems() {
        return unpackedMasterItems;
    }

    public void setUnpackedMasterItems(long unpackedMasterItems) {
        this.unpackedMasterItems = unpackedMasterItems;
    }

    public long getPackedPackets() {
        return packedPackets;
    }

    public void setPackedPackets(long packedPackets) {
        this.packedPackets = packedPackets;
    }

    public long getPendingPackets() {
        return pendingPackets;
    }

    public void setPendingPackets(long pendingPackets) {
        this.pendingPackets = pendingPackets;
    }

    public long getPacketItemsWithSticker() {
        return packetItemsWithSticker;
    }

    public void setPacketItemsWithSticker(long packetItemsWithSticker) {
        this.packetItemsWithSticker = packetItemsWithSticker;
    }

    public long getPacketItemsPendingSticker() {
        return packetItemsPendingSticker;
    }

    public void setPacketItemsPendingSticker(long packetItemsPendingSticker) {
        this.packetItemsPendingSticker = packetItemsPendingSticker;
    }

    public long getStickerReprints() {
        return stickerReprints;
    }

    public void setStickerReprints(long stickerReprints) {
        this.stickerReprints = stickerReprints;
    }

    public long getReadyToStoreItems() {
        return readyToStoreItems;
    }

    public void setReadyToStoreItems(long readyToStoreItems) {
        this.readyToStoreItems = readyToStoreItems;
    }

    public long getWarehouseRequestedItems() {
        return warehouseRequestedItems;
    }

    public void setWarehouseRequestedItems(long warehouseRequestedItems) {
        this.warehouseRequestedItems = warehouseRequestedItems;
    }

    public long getReturnRequestedItems() {
        return returnRequestedItems;
    }

    public void setReturnRequestedItems(long returnRequestedItems) {
        this.returnRequestedItems = returnRequestedItems;
    }

    public long getQueuedItems() {
        return queuedItems;
    }

    public void setQueuedItems(long queuedItems) {
        this.queuedItems = queuedItems;
    }

    public long getPkdItems() {
        return pkdItems;
    }

    public void setPkdItems(long pkdItems) {
        this.pkdItems = pkdItems;
    }

    public long getFgItems() {
        return fgItems;
    }

    public void setFgItems(long fgItems) {
        this.fgItems = fgItems;
    }

    public long getNormalDispatchChallans() {
        return normalDispatchChallans;
    }

    public void setNormalDispatchChallans(long normalDispatchChallans) {
        this.normalDispatchChallans = normalDispatchChallans;
    }

    public long getTodayDispatchChallans() {
        return todayDispatchChallans;
    }

    public void setTodayDispatchChallans(long todayDispatchChallans) {
        this.todayDispatchChallans = todayDispatchChallans;
    }

    public long getRunningTrips() {
        return runningTrips;
    }

    public void setRunningTrips(long runningTrips) {
        this.runningTrips = runningTrips;
    }

    public long getEndedTrips() {
        return endedTrips;
    }

    public void setEndedTrips(long endedTrips) {
        this.endedTrips = endedTrips;
    }

    public long getCustomChallans() {
        return customChallans;
    }

    public void setCustomChallans(long customChallans) {
        this.customChallans = customChallans;
    }

    public long getTodayCustomChallans() {
        return todayCustomChallans;
    }

    public void setTodayCustomChallans(long todayCustomChallans) {
        this.todayCustomChallans = todayCustomChallans;
    }

    public long getCustomChallanItems() {
        return customChallanItems;
    }

    public void setCustomChallanItems(long customChallanItems) {
        this.customChallanItems = customChallanItems;
    }

    public long getActiveDrivers() {
        return activeDrivers;
    }

    public void setActiveDrivers(long activeDrivers) {
        this.activeDrivers = activeDrivers;
    }

    public long getActiveVehicles() {
        return activeVehicles;
    }

    public void setActiveVehicles(long activeVehicles) {
        this.activeVehicles = activeVehicles;
    }

    public long getExpiredFitness() {
        return expiredFitness;
    }

    public void setExpiredFitness(long expiredFitness) {
        this.expiredFitness = expiredFitness;
    }

    public long getExpiredInsurance() {
        return expiredInsurance;
    }

    public void setExpiredInsurance(long expiredInsurance) {
        this.expiredInsurance = expiredInsurance;
    }

    public long getExpiredPucc() {
        return expiredPucc;
    }

    public void setExpiredPucc(long expiredPucc) {
        this.expiredPucc = expiredPucc;
    }

    public long getExceptionsCount() {
        return exceptionsCount;
    }

    public void setExceptionsCount(long exceptionsCount) {
        this.exceptionsCount = exceptionsCount;
    }

    public long getMasterItemsWithoutPackets() {
        return masterItemsWithoutPackets;
    }

    public void setMasterItemsWithoutPackets(long masterItemsWithoutPackets) {
        this.masterItemsWithoutPackets = masterItemsWithoutPackets;
    }

    public long getPacketsWithoutPacketItems() {
        return packetsWithoutPacketItems;
    }

    public void setPacketsWithoutPacketItems(long packetsWithoutPacketItems) {
        this.packetsWithoutPacketItems = packetsWithoutPacketItems;
    }

    public long getPacketItemsWithoutMaster() {
        return packetItemsWithoutMaster;
    }

    public void setPacketItemsWithoutMaster(long packetItemsWithoutMaster) {
        this.packetItemsWithoutMaster = packetItemsWithoutMaster;
    }

    public long getDispatchedWithoutPacketItem() {
        return dispatchedWithoutPacketItem;
    }

    public void setDispatchedWithoutPacketItem(long dispatchedWithoutPacketItem) {
        this.dispatchedWithoutPacketItem = dispatchedWithoutPacketItem;
    }

    public long getDispatchedWithoutChallan() {
        return dispatchedWithoutChallan;
    }

    public void setDispatchedWithoutChallan(long dispatchedWithoutChallan) {
        this.dispatchedWithoutChallan = dispatchedWithoutChallan;
    }

    public long getDispatchedWithoutDriver() {
        return dispatchedWithoutDriver;
    }

    public void setDispatchedWithoutDriver(long dispatchedWithoutDriver) {
        this.dispatchedWithoutDriver = dispatchedWithoutDriver;
    }

    public long getDuplicateCurrentStickers() {
        return duplicateCurrentStickers;
    }

    public void setDuplicateCurrentStickers(long duplicateCurrentStickers) {
        this.duplicateCurrentStickers = duplicateCurrentStickers;
    }

    public long getReadyItemsStillInPkd() {
        return readyItemsStillInPkd;
    }

    public void setReadyItemsStillInPkd(long readyItemsStillInPkd) {
        this.readyItemsStillInPkd = readyItemsStillInPkd;
    }
}