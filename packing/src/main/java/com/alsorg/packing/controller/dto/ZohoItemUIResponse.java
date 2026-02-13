package com.alsorg.packing.controller.dto;
public class ZohoItemUIResponse {
    private String zohoItemId;
    private String name;
    private String sku;
    private String location;
    private String clientName;
    private String clientAddress;
    private boolean packed;
    private Integer stock;

    public ZohoItemUIResponse() {
    }
    public ZohoItemUIResponse(
            String zohoItemId,
            String name,
            String sku,
            String location,
            String clientName,
            String clientAddress,
            boolean packed
    ) {
        this.zohoItemId = zohoItemId;
        this.name = name;
        this.sku = sku;
        this.location = location;
        this.clientName = clientName;
        this.clientAddress = clientAddress;
        this.packed = packed;
    }
    public String getZohoItemId() {
        return zohoItemId;
    }
    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String getSku() {
        return sku;
    }
    public void setSku(String sku) {
        this.sku = sku;
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
    public String getClientAddress() {
        return clientAddress;
    }
    public void setClientAddress(String clientAddress) {
        this.clientAddress = clientAddress;
    }
    public boolean isPacked() {
        return packed;
    }
    public void setPacked(boolean packed) {
        this.packed = packed;
    }
    public Integer getStock() {
        return stock;
    }
    public void setStock(Integer stock) {
        this.stock = stock;
    }
}
