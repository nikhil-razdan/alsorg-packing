package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDateTime;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public class EndTripRequest {

    private LocalDateTime tripEnd;

    @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.")
    private String remarks;

    @Size(max = 200, message = "Receiver name cannot exceed 200 characters.")
    private String receiverName;

    @Size(max = 50, message = "Receiver phone cannot exceed 50 characters.")
    private String receiverPhone;

    @Size(max = 2048, message = "POD URL cannot exceed 2048 characters.")
    private String podUrl;

    @Size(max = 2000, message = "Delivery remarks cannot exceed 2000 characters.")
    private String deliveryRemarks;

    @DecimalMin(value = "-90.0", inclusive = true, message = "Latitude must be at least -90.")
    @DecimalMax(value = "90.0", inclusive = true, message = "Latitude must be at most 90.")
    private Double deliveryLatitude;

    @DecimalMin(value = "-180.0", inclusive = true, message = "Longitude must be at least -180.")
    @DecimalMax(value = "180.0", inclusive = true, message = "Longitude must be at most 180.")
    private Double deliveryLongitude;

    @DecimalMin(value = "0.0", inclusive = true, message = "Location accuracy cannot be negative.")
    @DecimalMax(value = "1000000.0", inclusive = true, message = "Location accuracy is too large.")
    private Double deliveryLocationAccuracy;

    public LocalDateTime getTripEnd() {
        return tripEnd;
    }

    public void setTripEnd(LocalDateTime tripEnd) {
        this.tripEnd = tripEnd;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverPhone() {
        return receiverPhone;
    }

    public void setReceiverPhone(String receiverPhone) {
        this.receiverPhone = receiverPhone;
    }

    public String getPodUrl() {
        return podUrl;
    }

    public void setPodUrl(String podUrl) {
        this.podUrl = podUrl;
    }

    public String getDeliveryRemarks() {
        return deliveryRemarks;
    }

    public void setDeliveryRemarks(String deliveryRemarks) {
        this.deliveryRemarks = deliveryRemarks;
    }

    public Double getDeliveryLatitude() {
        return deliveryLatitude;
    }

    public void setDeliveryLatitude(Double deliveryLatitude) {
        this.deliveryLatitude = deliveryLatitude;
    }

    public Double getDeliveryLongitude() {
        return deliveryLongitude;
    }

    public void setDeliveryLongitude(Double deliveryLongitude) {
        this.deliveryLongitude = deliveryLongitude;
    }

    public Double getDeliveryLocationAccuracy() {
        return deliveryLocationAccuracy;
    }

    public void setDeliveryLocationAccuracy(Double deliveryLocationAccuracy) {
        this.deliveryLocationAccuracy = deliveryLocationAccuracy;
    }
}
