package com.alsorg.packing.controller.dto;

import jakarta.validation.constraints.Size;

public class PlantAssignmentRequest {

    @Size(max = 100, message = "Plant code cannot exceed 100 characters.")
    private String plantCode;

    @Size(max = 255, message = "Current location code cannot exceed 255 characters.")
    private String currentLocationCode;

    @Size(max = 255, message = "FG zone code cannot exceed 255 characters.")
    private String fgZoneCode;

    @Size(max = 255, message = "Warehouse code cannot exceed 255 characters.")
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
