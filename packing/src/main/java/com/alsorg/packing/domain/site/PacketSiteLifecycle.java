package com.alsorg.packing.domain.site;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

@Entity
@Table(
        name = "packet_site_lifecycle",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_packet_site_lifecycle_packet_item",
                        columnNames = "packet_item_id")
        },
        indexes = {
                @Index(
                        name = "idx_packet_site_lifecycle_status_updated",
                        columnList = "site_status,updated_at"),
                @Index(
                        name = "idx_packet_site_lifecycle_challan",
                        columnList = "challan_number"),
                @Index(
                        name = "idx_packet_site_lifecycle_zoho_item",
                        columnList = "zoho_item_id")
        })
public class PacketSiteLifecycle {

    @Id
    private UUID id;

    @Column(name = "packet_item_id", nullable = false)
    private UUID packetItemId;

    @Column(name = "zoho_item_id", nullable = false, length = 255)
    private String zohoItemId;

    @Column(name = "challan_number", length = 255)
    private String challanNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "site_status", nullable = false, length = 40)
    private SiteLifecycleStatus siteStatus;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "delivered_by", length = 180)
    private String deliveredBy;

    @Column(name = "delivery_latitude")
    private Double deliveryLatitude;

    @Column(name = "delivery_longitude")
    private Double deliveryLongitude;

    @Column(name = "delivery_accuracy")
    private Double deliveryAccuracy;

    @Column(name = "receiver_name", length = 300)
    private String receiverName;

    @Column(name = "receiver_phone", length = 100)
    private String receiverPhone;

    @Column(name = "delivery_remarks", length = 2000)
    private String deliveryRemarks;

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "opened_by", length = 180)
    private String openedBy;

    @Column(name = "opening_latitude")
    private Double openingLatitude;

    @Column(name = "opening_longitude")
    private Double openingLongitude;

    @Column(name = "opening_accuracy")
    private Double openingAccuracy;

    @Column(name = "opening_remarks", length = 2000)
    private String openingRemarks;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getPacketItemId() { return packetItemId; }
    public void setPacketItemId(UUID packetItemId) { this.packetItemId = packetItemId; }
    public String getZohoItemId() { return zohoItemId; }
    public void setZohoItemId(String zohoItemId) { this.zohoItemId = zohoItemId; }
    public String getChallanNumber() { return challanNumber; }
    public void setChallanNumber(String challanNumber) { this.challanNumber = challanNumber; }
    public SiteLifecycleStatus getSiteStatus() { return siteStatus; }
    public void setSiteStatus(SiteLifecycleStatus siteStatus) { this.siteStatus = siteStatus; }
    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }
    public String getDeliveredBy() { return deliveredBy; }
    public void setDeliveredBy(String deliveredBy) { this.deliveredBy = deliveredBy; }
    public Double getDeliveryLatitude() { return deliveryLatitude; }
    public void setDeliveryLatitude(Double deliveryLatitude) { this.deliveryLatitude = deliveryLatitude; }
    public Double getDeliveryLongitude() { return deliveryLongitude; }
    public void setDeliveryLongitude(Double deliveryLongitude) { this.deliveryLongitude = deliveryLongitude; }
    public Double getDeliveryAccuracy() { return deliveryAccuracy; }
    public void setDeliveryAccuracy(Double deliveryAccuracy) { this.deliveryAccuracy = deliveryAccuracy; }
    public String getReceiverName() { return receiverName; }
    public void setReceiverName(String receiverName) { this.receiverName = receiverName; }
    public String getReceiverPhone() { return receiverPhone; }
    public void setReceiverPhone(String receiverPhone) { this.receiverPhone = receiverPhone; }
    public String getDeliveryRemarks() { return deliveryRemarks; }
    public void setDeliveryRemarks(String deliveryRemarks) { this.deliveryRemarks = deliveryRemarks; }
    public LocalDateTime getOpenedAt() { return openedAt; }
    public void setOpenedAt(LocalDateTime openedAt) { this.openedAt = openedAt; }
    public String getOpenedBy() { return openedBy; }
    public void setOpenedBy(String openedBy) { this.openedBy = openedBy; }
    public Double getOpeningLatitude() { return openingLatitude; }
    public void setOpeningLatitude(Double openingLatitude) { this.openingLatitude = openingLatitude; }
    public Double getOpeningLongitude() { return openingLongitude; }
    public void setOpeningLongitude(Double openingLongitude) { this.openingLongitude = openingLongitude; }
    public Double getOpeningAccuracy() { return openingAccuracy; }
    public void setOpeningAccuracy(Double openingAccuracy) { this.openingAccuracy = openingAccuracy; }
    public String getOpeningRemarks() { return openingRemarks; }
    public void setOpeningRemarks(String openingRemarks) { this.openingRemarks = openingRemarks; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getRowVersion() { return rowVersion; }
    public void setRowVersion(Long rowVersion) { this.rowVersion = rowVersion; }
}
