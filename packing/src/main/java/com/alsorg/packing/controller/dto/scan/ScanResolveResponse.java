package com.alsorg.packing.controller.dto.scan;

import java.util.List;

public class ScanResolveResponse {

    private String packetItemId;
    private String zohoItemId;
    private String stickerNumber;
    private String itemName;
    private String sku;
    private String pdNo;
    private String drawingNo;
    private String clientName;
    private String description;
    private String status;
    private boolean dispatchAllowed;
    private String message;
    private String plantCode;
    private String packedAreaCode;
    private String currentLocationCode;
    private String fgAreaCode;
    private String fgZoneCode;
    private boolean moveToFgRequired;
    private boolean fgZoneRequired;
    private List<String> fgZones;

    public String getPacketItemId() {
        return packetItemId;
    }

    public void setPacketItemId(String packetItemId) {
        this.packetItemId = packetItemId;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public String getStickerNumber() {
        return stickerNumber;
    }

    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getPdNo() {
        return pdNo;
    }

    public void setPdNo(String pdNo) {
        this.pdNo = pdNo;
    }

    public String getDrawingNo() {
        return drawingNo;
    }

    public void setDrawingNo(String drawingNo) {
        this.drawingNo = drawingNo;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isDispatchAllowed() {
        return dispatchAllowed;
    }

    public void setDispatchAllowed(boolean dispatchAllowed) {
        this.dispatchAllowed = dispatchAllowed;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(String plantCode) {
        this.plantCode = plantCode;
    }

    public String getPackedAreaCode() {
        return packedAreaCode;
    }

    public void setPackedAreaCode(String packedAreaCode) {
        this.packedAreaCode = packedAreaCode;
    }

    public String getCurrentLocationCode() {
        return currentLocationCode;
    }

    public void setCurrentLocationCode(String currentLocationCode) {
        this.currentLocationCode = currentLocationCode;
    }

    public String getFgAreaCode() {
        return fgAreaCode;
    }

    public void setFgAreaCode(String fgAreaCode) {
        this.fgAreaCode = fgAreaCode;
    }

    public String getFgZoneCode() {
        return fgZoneCode;
    }

    public void setFgZoneCode(String fgZoneCode) {
        this.fgZoneCode = fgZoneCode;
    }

    public boolean isMoveToFgRequired() {
        return moveToFgRequired;
    }

    public void setMoveToFgRequired(boolean moveToFgRequired) {
        this.moveToFgRequired = moveToFgRequired;
    }

    public boolean isFgZoneRequired() {
        return fgZoneRequired;
    }

    public void setFgZoneRequired(boolean fgZoneRequired) {
        this.fgZoneRequired = fgZoneRequired;
    }

    public List<String> getFgZones() {
        return fgZones;
    }

    public void setFgZones(List<String> fgZones) {
        this.fgZones = fgZones;
    }
}
