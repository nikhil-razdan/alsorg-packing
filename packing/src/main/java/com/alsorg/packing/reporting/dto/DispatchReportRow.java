package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public class DispatchReportRow {

    private String zohoItemId;

    private String pdNo;
    private String drawingNo;
    private String sku;

    private String itemName;
    private String description;

    private String clientName;
    private String clientAddress;

    /*
     * Current operational area / location.
     */
    private String area;

    private String plantCode;
    private String floor;

    private String packetNumber;
    private String packetName;

    private Integer quantity;
    private String status;

    private LocalDateTime packedAt;
    private String packedBy;

    private LocalDateTime dispatchedAt;
    private String dispatchedBy;

    private String challanNumber;
    private String driverName;
    private String vehicleNumber;

    private String warehouseCode;
    private String remarks;

    public DispatchReportRow() {
    }

    /*
     * Legacy constructor retained so any older JPQL, tests,
     * or internal code using the previous constructor continues working.
     */
    public DispatchReportRow(
            String zohoItemId,
            String itemName,
            String clientName,
            String packetNumber,
            String packetName,
            LocalDateTime dispatchedAt,
            String dispatchedBy
    ) {
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.clientName = clientName;
        this.packetNumber = packetNumber;
        this.packetName = packetName;
        this.dispatchedAt = dispatchedAt;
        this.dispatchedBy = dispatchedBy;
    }

    public DispatchReportRow(
            String zohoItemId,
            String pdNo,
            String drawingNo,
            String sku,
            String itemName,
            String description,
            String clientName,
            String clientAddress,
            String area,
            String plantCode,
            String floor,
            String packetNumber,
            String packetName,
            Integer quantity,
            String status,
            LocalDateTime packedAt,
            String packedBy,
            LocalDateTime dispatchedAt,
            String dispatchedBy,
            String challanNumber,
            String driverName,
            String vehicleNumber,
            String warehouseCode,
            String remarks
    ) {
        this.zohoItemId = zohoItemId;
        this.pdNo = pdNo;
        this.drawingNo = drawingNo;
        this.sku = sku;
        this.itemName = itemName;
        this.description = description;
        this.clientName = clientName;
        this.clientAddress = clientAddress;
        this.area = area;
        this.plantCode = plantCode;
        this.floor = floor;
        this.packetNumber = packetNumber;
        this.packetName = packetName;
        this.quantity = quantity;
        this.status = status;
        this.packedAt = packedAt;
        this.packedBy = packedBy;
        this.dispatchedAt = dispatchedAt;
        this.dispatchedBy = dispatchedBy;
        this.challanNumber = challanNumber;
        this.driverName = driverName;
        this.vehicleNumber = vehicleNumber;
        this.warehouseCode = warehouseCode;
        this.remarks = remarks;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
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

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
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

    public String getArea() {
        return area;
    }

    public void setArea(String area) {
        this.area = area;
    }

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(String plantCode) {
        this.plantCode = plantCode;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public String getPacketNumber() {
        return packetNumber;
    }

    public void setPacketNumber(String packetNumber) {
        this.packetNumber = packetNumber;
    }

    public String getPacketName() {
        return packetName;
    }

    public void setPacketName(String packetName) {
        this.packetName = packetName;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getPackedAt() {
        return packedAt;
    }

    public void setPackedAt(LocalDateTime packedAt) {
        this.packedAt = packedAt;
    }

    public String getPackedBy() {
        return packedBy;
    }

    public void setPackedBy(String packedBy) {
        this.packedBy = packedBy;
    }

    public LocalDateTime getDispatchedAt() {
        return dispatchedAt;
    }

    public void setDispatchedAt(LocalDateTime dispatchedAt) {
        this.dispatchedAt = dispatchedAt;
    }

    public String getDispatchedBy() {
        return dispatchedBy;
    }

    public void setDispatchedBy(String dispatchedBy) {
        this.dispatchedBy = dispatchedBy;
    }

    public String getChallanNumber() {
        return challanNumber;
    }

    public void setChallanNumber(String challanNumber) {
        this.challanNumber = challanNumber;
    }

    public String getDriverName() {
        return driverName;
    }

    public void setDriverName(String driverName) {
        this.driverName = driverName;
    }

    public String getVehicleNumber() {
        return vehicleNumber;
    }

    public void setVehicleNumber(String vehicleNumber) {
        this.vehicleNumber = vehicleNumber;
    }

    public String getWarehouseCode() {
        return warehouseCode;
    }

    public void setWarehouseCode(String warehouseCode) {
        this.warehouseCode = warehouseCode;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}