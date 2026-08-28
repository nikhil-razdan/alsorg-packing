package com.alsorg.packing.controller.dto;

import jakarta.validation.constraints.Size;

public class UpdatePacketItemRequest {

    @Size(max = 500, message = "Item name cannot exceed 500 characters.")
    private String itemName;

    @Size(max = 255, message = "PD number cannot exceed 255 characters.")
    private String pdNo;

    @Size(max = 255, message = "Drawing number cannot exceed 255 characters.")
    private String drawingNo;

    @Size(max = 500, message = "Client name cannot exceed 500 characters.")
    private String clientName;

    @Size(max = 2000, message = "Client address cannot exceed 2000 characters.")
    private String clientAddress;

    @Size(max = 100, message = "Floor cannot exceed 100 characters.")
    private String floor;

    @Size(max = 5000, message = "Description cannot exceed 5000 characters.")
    private String description;

    @Size(max = 200, message = "Weight cannot exceed 200 characters.")
    private String weight;

    @Size(max = 500, message = "Dimensions cannot exceed 500 characters.")
    private String dimensions;

    @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.")
    private String remarks;

    @Size(max = 255, message = "Location cannot exceed 255 characters.")
    private String location;

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
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

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getWeight() {
        return weight;
    }

    public void setWeight(String weight) {
        this.weight = weight;
    }

    public String getDimensions() {
        return dimensions;
    }

    public void setDimensions(String dimensions) {
        this.dimensions = dimensions;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }
}
