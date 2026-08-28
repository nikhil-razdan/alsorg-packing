package com.alsorg.packing.controller.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public class PacketItemRequest {

    @Size(max = 500, message = "Item name cannot exceed 500 characters.")
    private String itemName;

    @Size(max = 255, message = "SKU cannot exceed 255 characters.")
    private String sku;

    @Size(max = 300, message = "Zoho item id cannot exceed 300 characters.")
    private String zohoItemId;

    @Min(value = 1, message = "Quantity must be at least 1.")
    @Max(value = 1000000, message = "Quantity is too large.")
    private Integer quantity;

    @Size(max = 5000, message = "Description cannot exceed 5000 characters.")
    private String description;

    @Size(max = 255, message = "Location cannot exceed 255 characters.")
    private String location;

    @Size(max = 100, message = "Floor cannot exceed 100 characters.")
    private String floor;

    @Size(max = 255, message = "PD number cannot exceed 255 characters.")
    private String pdNo;

    @Size(max = 255, message = "Drawing number cannot exceed 255 characters.")
    private String drawingNo;

    @Size(max = 500, message = "Client name cannot exceed 500 characters.")
    private String clientName;

    @Size(max = 2000, message = "Client address cannot exceed 2000 characters.")
    private String clientAddress;

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

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
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
