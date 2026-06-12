package com.alsorg.packing.controller.dto.logistics;

import java.util.UUID;

public class LogisticsTripItemResponse {

    private UUID id;
    private UUID tripId;

    private String zohoItemId;
    private UUID packetItemId;

    private String itemName;
    private String sku;
    private String pdNo;
    private String drawingNo;
    private String clientName;
    private String description;
    private String remarks;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTripId() {
        return tripId;
    }

    public void setTripId(UUID tripId) {
        this.tripId = tripId;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public UUID getPacketItemId() {
        return packetItemId;
    }

    public void setPacketItemId(UUID packetItemId) {
        this.packetItemId = packetItemId;
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

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}