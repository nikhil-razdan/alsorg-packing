package com.alsorg.packing.controller.dto.scan;

public class ScanRequest {

    private String scanText;
    private java.util.UUID driverId;

    private java.util.UUID vehicleId;

    private java.time.LocalDateTime tripStart;
    
    public String getScanText() {
        return scanText;
    }

    public void setScanText(String scanText) {
        this.scanText = scanText;
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