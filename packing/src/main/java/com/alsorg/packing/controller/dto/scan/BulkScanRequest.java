package com.alsorg.packing.controller.dto.scan;

import java.util.List;

public class BulkScanRequest {

    private List<String> scanTexts;
    
    private java.util.UUID driverId;

    private java.util.UUID vehicleId;

    private java.time.LocalDateTime tripStart;

    public List<String> getScanTexts() {
        return scanTexts;
    }

    public void setScanTexts(List<String> scanTexts) {
        this.scanTexts = scanTexts;
    }

	public java.util.UUID getDriverId() {
		return driverId;
	}

	public void setDriverId(java.util.UUID driverId) {
		this.driverId = driverId;
	}

	public java.util.UUID getVehicleId() {
		return vehicleId;
	}

	public void setVehicleId(java.util.UUID vehicleId) {
		this.vehicleId = vehicleId;
	}

	public java.time.LocalDateTime getTripStart() {
		return tripStart;
	}

	public void setTripStart(java.time.LocalDateTime tripStart) {
		this.tripStart = tripStart;
	}
}