package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDateTime;
import java.util.UUID;

public class CreateShiftRequest {

    private UUID driverId;

    private UUID vehicleId;

    private LocalDateTime shiftStart;

    private LocalDateTime shiftEnd;

    private Double overtimeHours;

    private Integer totalTrips;

    private Integer totalLoaders;

    private Double fuelUsed;

    private Double totalDistance;

    private String routeCategory;

    private String remarks;

    private String status;

    // GETTERS & SETTERS

    public UUID getDriverId() {
        return driverId;
    }

    public void setDriverId(UUID driverId) {
        this.driverId = driverId;
    }

    public UUID getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(UUID vehicleId) {
        this.vehicleId = vehicleId;
    }

    public LocalDateTime getShiftStart() {
        return shiftStart;
    }

    public void setShiftStart(LocalDateTime shiftStart) {
        this.shiftStart = shiftStart;
    }

    public LocalDateTime getShiftEnd() {
        return shiftEnd;
    }

    public void setShiftEnd(LocalDateTime shiftEnd) {
        this.shiftEnd = shiftEnd;
    }

    public Double getOvertimeHours() {
        return overtimeHours;
    }

    public void setOvertimeHours(Double overtimeHours) {
        this.overtimeHours = overtimeHours;
    }

    public Integer getTotalTrips() {
        return totalTrips;
    }

    public void setTotalTrips(Integer totalTrips) {
        this.totalTrips = totalTrips;
    }

    public Integer getTotalLoaders() {
        return totalLoaders;
    }

    public void setTotalLoaders(Integer totalLoaders) {
        this.totalLoaders = totalLoaders;
    }

    public Double getFuelUsed() {
        return fuelUsed;
    }

    public void setFuelUsed(Double fuelUsed) {
        this.fuelUsed = fuelUsed;
    }

    public Double getTotalDistance() {
        return totalDistance;
    }

    public void setTotalDistance(Double totalDistance) {
        this.totalDistance = totalDistance;
    }

    public String getRouteCategory() {
        return routeCategory;
    }

    public void setRouteCategory(String routeCategory) {
        this.routeCategory = routeCategory;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}