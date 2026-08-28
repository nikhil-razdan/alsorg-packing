package com.alsorg.packing.domain.logistics;

import com.alsorg.packing.config.TimeZoneConfig;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "logistics_trips")
public class LogisticsTrip {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "driver_id", nullable = false)
    private Driver driver;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private Vehicle vehicle;

    @Column(nullable = false, unique = true)
    private String challanNumber;

    private LocalDateTime tripStart;
    private LocalDateTime tripEnd;

    @Enumerated(EnumType.STRING)
    private LogisticsTripStatus status;

    private Integer totalItems;
    private String source;
    private String createdBy;
    private String endedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Column(length = 1000)
    private String remarks;

    private String receiverName;
    private String receiverPhone;
    private String podUrl;

    @Column(length = 1500)
    private String deliveryRemarks;

    private Double deliveryLatitude;
    private Double deliveryLongitude;
    private Double deliveryLocationAccuracy;
    private Double currentLatitude;
    private Double currentLongitude;
    private Double currentLocationAccuracy;
    private LocalDateTime currentLocationAt;
    private String currentLocationBy;
    private LocalDateTime queuedAt;
    private Double currentSpeed;
    private Double currentHeading;
    private Double currentAltitude;

    @PrePersist
    private void initialiseTimestamps() {
        LocalDateTime now = LocalDateTime.now(TimeZoneConfig.APP_ZONE);
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    private void touchUpdatedAt() {
        updatedAt = LocalDateTime.now(TimeZoneConfig.APP_ZONE);
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Driver getDriver() { return driver; }
    public void setDriver(Driver driver) { this.driver = driver; }
    public Vehicle getVehicle() { return vehicle; }
    public void setVehicle(Vehicle vehicle) { this.vehicle = vehicle; }
    public String getChallanNumber() { return challanNumber; }
    public void setChallanNumber(String challanNumber) { this.challanNumber = challanNumber; }
    public LocalDateTime getTripStart() { return tripStart; }
    public void setTripStart(LocalDateTime tripStart) { this.tripStart = tripStart; }
    public LocalDateTime getTripEnd() { return tripEnd; }
    public void setTripEnd(LocalDateTime tripEnd) { this.tripEnd = tripEnd; }
    public LogisticsTripStatus getStatus() { return status; }
    public void setStatus(LogisticsTripStatus status) { this.status = status; }
    public Integer getTotalItems() { return totalItems; }
    public void setTotalItems(Integer totalItems) { this.totalItems = totalItems; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getEndedBy() { return endedBy; }
    public void setEndedBy(String endedBy) { this.endedBy = endedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getReceiverName() { return receiverName; }
    public void setReceiverName(String receiverName) { this.receiverName = receiverName; }
    public String getReceiverPhone() { return receiverPhone; }
    public void setReceiverPhone(String receiverPhone) { this.receiverPhone = receiverPhone; }
    public String getPodUrl() { return podUrl; }
    public void setPodUrl(String podUrl) { this.podUrl = podUrl; }
    public String getDeliveryRemarks() { return deliveryRemarks; }
    public void setDeliveryRemarks(String deliveryRemarks) { this.deliveryRemarks = deliveryRemarks; }
    public Double getDeliveryLatitude() { return deliveryLatitude; }
    public void setDeliveryLatitude(Double deliveryLatitude) { this.deliveryLatitude = deliveryLatitude; }
    public Double getDeliveryLongitude() { return deliveryLongitude; }
    public void setDeliveryLongitude(Double deliveryLongitude) { this.deliveryLongitude = deliveryLongitude; }
    public Double getDeliveryLocationAccuracy() { return deliveryLocationAccuracy; }
    public void setDeliveryLocationAccuracy(Double deliveryLocationAccuracy) { this.deliveryLocationAccuracy = deliveryLocationAccuracy; }
    public Double getCurrentLatitude() { return currentLatitude; }
    public void setCurrentLatitude(Double currentLatitude) { this.currentLatitude = currentLatitude; }
    public Double getCurrentLongitude() { return currentLongitude; }
    public void setCurrentLongitude(Double currentLongitude) { this.currentLongitude = currentLongitude; }
    public Double getCurrentLocationAccuracy() { return currentLocationAccuracy; }
    public void setCurrentLocationAccuracy(Double currentLocationAccuracy) { this.currentLocationAccuracy = currentLocationAccuracy; }
    public LocalDateTime getCurrentLocationAt() { return currentLocationAt; }
    public void setCurrentLocationAt(LocalDateTime currentLocationAt) { this.currentLocationAt = currentLocationAt; }
    public String getCurrentLocationBy() { return currentLocationBy; }
    public void setCurrentLocationBy(String currentLocationBy) { this.currentLocationBy = currentLocationBy; }
    public LocalDateTime getQueuedAt() { return queuedAt; }
    public void setQueuedAt(LocalDateTime queuedAt) { this.queuedAt = queuedAt; }
    public Double getCurrentSpeed() { return currentSpeed; }
    public void setCurrentSpeed(Double currentSpeed) { this.currentSpeed = currentSpeed; }
    public Double getCurrentHeading() { return currentHeading; }
    public void setCurrentHeading(Double currentHeading) { this.currentHeading = currentHeading; }
    public Double getCurrentAltitude() { return currentAltitude; }
    public void setCurrentAltitude(Double currentAltitude) { this.currentAltitude = currentAltitude; }
}
