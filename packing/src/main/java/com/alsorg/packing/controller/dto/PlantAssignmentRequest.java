package com.alsorg.packing.controller.dto;

public class PlantAssignmentRequest {

    private String plantCode;
    private String currentLocationCode;
    private String fgZoneCode;
    private String warehouseCode;

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(String plantCode) {
        this.plantCode = plantCode;
    }

    public String getCurrentLocationCode() {
        return currentLocationCode;
    }

    public void setCurrentLocationCode(String currentLocationCode) {
        this.currentLocationCode = currentLocationCode;
    }

    public String getFgZoneCode() {
        return fgZoneCode;
    }

    public void setFgZoneCode(String fgZoneCode) {
        this.fgZoneCode = fgZoneCode;
    }

    public String getWarehouseCode() {
        return warehouseCode;
    }

    public void setWarehouseCode(String warehouseCode) {
        this.warehouseCode = warehouseCode;
    }
}