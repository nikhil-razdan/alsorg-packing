package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Dispatch challan creation payload.
 *
 * Driver and vehicle remain optional because PackFlow explicitly supports
 * challan creation without either value.
 */
public class DispatchTripRequest {

    @NotEmpty(message = "Select at least one dispatch item.")
    @Size(max = 1000, message = "A maximum of 1000 dispatch items is allowed in one request.")
    private List<
            @NotBlank(message = "Dispatch item id cannot be blank.")
            @Size(max = 300, message = "Dispatch item id is too long.")
            String> itemIds;

    private UUID driverId;
    private UUID vehicleId;
    private LocalDateTime tripStart;

    @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.")
    private String remarks;

    public List<String> getItemIds() {
        return itemIds;
    }

    public void setItemIds(List<String> itemIds) {
        this.itemIds = itemIds;
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

    public LocalDateTime getTripStart() {
        return tripStart;
    }

    public void setTripStart(LocalDateTime tripStart) {
        this.tripStart = tripStart;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}
