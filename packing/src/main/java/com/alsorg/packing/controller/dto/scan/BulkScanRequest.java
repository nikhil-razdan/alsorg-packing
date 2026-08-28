package com.alsorg.packing.controller.dto.scan;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Request used by scanner bulk dispatch.
 *
 * Driver and vehicle are optional.
 * helperLoaderCount is optional and must reach DispatchChallanService/PDF.
 * dispatchTime is the current field; tripStart remains for backward
 * compatibility.
 */
public class BulkScanRequest {

    @NotEmpty(message = "At least one scan is required.")
    @Size(max = 1000, message = "A maximum of 1000 scans is allowed in one dispatch.")
    private List<
            @NotBlank(message = "Scan text cannot be blank.")
            @Size(max = 1000, message = "Scan text is too long.")
            String> scanTexts;

    private UUID driverId;
    private UUID vehicleId;

    @Min(value = 0, message = "Helper/loader count cannot be negative.")
    @Max(value = 10000, message = "Helper/loader count is too large.")
    private Integer helperLoaderCount;

    private LocalDateTime dispatchTime;
    private LocalDateTime tripStart;

    public List<String> getScanTexts() {
        return scanTexts;
    }

    public void setScanTexts(List<String> scanTexts) {
        this.scanTexts = scanTexts;
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
