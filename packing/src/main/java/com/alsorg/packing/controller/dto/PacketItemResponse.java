package com.alsorg.packing.controller.dto;

import java.util.UUID;

public class PacketItemResponse {

    private UUID itemId;
    private String itemName;
    private String sku;
    private String zohoItemId;
    private int quantity;
    private String description;
    private String location;
    private String floor;
    private String pdNo;
    private String drawingNo;
    private String clientName;
    private String clientAddress;

    public PacketItemResponse() {
    }

    public UUID getItemId() {
        return itemId;
    }

    public void setItemId(UUID itemId) {
        this.itemId = itemId;
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

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
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

    public String getClientAddress() {
        return clientAddress;
    }

    public void setClientAddress(String clientAddress) {
        this.clientAddress = clientAddress;
    }
}
