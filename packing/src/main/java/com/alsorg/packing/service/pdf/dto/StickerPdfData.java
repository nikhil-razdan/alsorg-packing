package com.alsorg.packing.service.pdf.dto;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;

public class StickerPdfData {

    // System generated
    private String stickerNumber;
    private String barcodeText;
    private String date;

    // Zoho Item fields
    private String itemName;
    private String description;
    private int quantity;
    private String location;
    private String floor;
    private String clientName;
    private String clientAddress;
    private String pdNo;
    private String drawingNo;
    private String remarks;
    private String sku;
    private String zohoItemId;
    private long printIteration;

    public long getPrintIteration() {
        return printIteration;
    }

    public void setPrintIteration(long printIteration) {
        this.printIteration = printIteration;
    }

    public static StickerPdfData fromZohoItem(
            ZohoItemDTO item,
            String stickerNumber
    ) {
        StickerPdfData data = new StickerPdfData();

        data.setStickerNumber(stickerNumber);
        data.setBarcodeText(stickerNumber);

        data.setItemName(item.getName());
        data.setDescription(item.getDescription());
        data.setLocation(item.getLocation());
        data.setFloor(item.getFloor());

        data.setClientName(item.getClientName());
        data.setClientAddress(item.getClientAddress());

        data.setPdNo(item.getPdNo());
        data.setDrawingNo(item.getDrawingNo());
        data.setRemarks(item.getRemarks());

        data.setQuantity(1);
        data.setDate(
            LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy"))
        );

        return data;
    }

    // getters & setters

    public String getStickerNumber() {
        return stickerNumber;
    }

    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }

    public String getBarcodeText() {
        return barcodeText;
    }

    public void setBarcodeText(String barcodeText) {
        this.barcodeText = barcodeText;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
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

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public String getClientAddress() {
        return clientAddress;
    }

    public void setClientAddress(String clientAddress) {
        this.clientAddress = clientAddress;
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

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
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
}
