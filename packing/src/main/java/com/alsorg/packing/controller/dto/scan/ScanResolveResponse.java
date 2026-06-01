package com.alsorg.packing.controller.dto.scan;

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
}