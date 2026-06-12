package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDateTime;

public class EndTripRequest {

    private LocalDateTime tripEnd;

    private String remarks;

    private String receiverName;

    private String receiverPhone;

    private String podUrl;

    private String deliveryRemarks;

    private Double deliveryLatitude;

    private Double deliveryLongitude;

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