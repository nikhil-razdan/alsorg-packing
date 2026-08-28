package com.alsorg.packing.controller.dto.scan;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request used by the scanner resolve / single-dispatch flow.
 *
 * Driver and vehicle are intentionally optional.
 * helperLoaderCount is optional and is persisted on the generated challan.
 * dispatchTime is the current field; tripStart is retained for older mobile
 * builds.
 */
public class ScanRequest {

    @NotBlank(message = "Scan text is required.")
    @Size(max = 1000, message = "Scan text is too long.")
    private String scanText;

    private UUID driverId;
    private UUID vehicleId;

    @Min(value = 0, message = "Helper/loader count cannot be negative.")
    @Max(value = 10000, message = "Helper/loader count is too large.")
    private Integer helperLoaderCount;

    private LocalDateTime dispatchTime;
    private LocalDateTime tripStart;

    public String getScanText() {
        return scanText;
    }

    public void setScanText(String scanText) {
        this.scanText = scanText;
    }

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

    public Integer getHelperLoaderCount() {
        return helperLoaderCount;
    }

    public void setHelperLoaderCount(Integer helperLoaderCount) {
        this.helperLoaderCount = helperLoaderCount;
    }

    public LocalDateTime getDispatchTime() {
        return dispatchTime;
    }

    public void setDispatchTime(LocalDateTime dispatchTime) {
        this.dispatchTime = dispatchTime;
    }

    public LocalDateTime getTripStart() {
        return tripStart;
    }

    public void setTripStart(LocalDateTime tripStart) {
        this.tripStart = tripStart;
    }
}
