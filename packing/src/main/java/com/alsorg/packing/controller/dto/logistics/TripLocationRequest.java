package com.alsorg.packing.controller.dto.logistics;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

public class TripLocationRequest {

    @DecimalMin(value = "-90.0", inclusive = true, message = "Latitude must be at least -90.")
    @DecimalMax(value = "90.0", inclusive = true, message = "Latitude must be at most 90.")
    private Double latitude;

    @DecimalMin(value = "-180.0", inclusive = true, message = "Longitude must be at least -180.")
    @DecimalMax(value = "180.0", inclusive = true, message = "Longitude must be at most 180.")
    private Double longitude;

    @DecimalMin(value = "0.0", inclusive = true, message = "Accuracy cannot be negative.")
    @DecimalMax(value = "1000000.0", inclusive = true, message = "Accuracy is too large.")
    private Double accuracy;

    @DecimalMin(value = "0.0", inclusive = true, message = "Speed cannot be negative.")
    @DecimalMax(value = "1000.0", inclusive = true, message = "Speed is too large.")
    private Double speed;

    @DecimalMin(value = "0.0", inclusive = true, message = "Heading cannot be negative.")
    @DecimalMax(value = "360.0", inclusive = true, message = "Heading cannot exceed 360 degrees.")
    private Double heading;

    @DecimalMin(value = "-10000.0", inclusive = true, message = "Altitude is too small.")
    @DecimalMax(value = "100000.0", inclusive = true, message = "Altitude is too large.")
    private Double altitude;

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Double accuracy) {
        this.accuracy = accuracy;
    }

    public Double getSpeed() {
        return speed;
    }

    public void setSpeed(Double speed) {
        this.speed = speed;
    }

    public Double getHeading() {
        return heading;
    }

    public void setHeading(Double heading) {
        this.heading = heading;
    }

    public Double getAltitude() {
        return altitude;
    }

    public void setAltitude(Double altitude) {
        this.altitude = altitude;
    }
}
