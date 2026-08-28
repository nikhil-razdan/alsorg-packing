package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * Create/update payload for one logistics shift.
 *
 * Driver/vehicle and date requirements remain service-authoritative so existing
 * manual workflows are not changed here. This DTO only bounds client-controlled
 * numeric/text input before it reaches the service layer.
 */
public class CreateShiftRequest {

    private UUID driverId;
    private UUID vehicleId;
    private LocalDateTime shiftStart;
    private LocalDateTime shiftEnd;

    @DecimalMin(value = "0.0", inclusive = true, message = "Overtime hours cannot be negative.")
    @DecimalMax(value = "168.0", inclusive = true, message = "Overtime hours are too large.")
    private Double overtimeHours;

    @Min(value = 0, message = "Total trips cannot be negative.")
    @Max(value = 10000, message = "Total trips are too large.")
    private Integer totalTrips;

    @Min(value = 0, message = "Total loaders cannot be negative.")
    @Max(value = 10000, message = "Total loaders are too large.")
    private Integer totalLoaders;

    @DecimalMin(value = "0.0", inclusive = true, message = "Fuel used cannot be negative.")
    @DecimalMax(value = "1000000000.0", inclusive = true, message = "Fuel used is too large.")
    private Double fuelUsed;

    @DecimalMin(value = "0.0", inclusive = true, message = "Total distance cannot be negative.")
    @DecimalMax(value = "1000000000.0", inclusive = true, message = "Total distance is too large.")
    private Double totalDistance;

    @Size(max = 100, message = "Route category cannot exceed 100 characters.")
    private String routeCategory;

    @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.")
    private String remarks;

    @Size(max = 40, message = "Shift status cannot exceed 40 characters.")
    private String status;

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
