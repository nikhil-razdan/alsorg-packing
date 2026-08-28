package com.alsorg.packing.domain.item;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.common.PacketItemType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
public class MasterItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String itemName;
    private String pdNo;
    private String drawingName;
    private String clientName;
    private String address;
    private String floor;
    private Integer totalPackets;

    private String plantCode;
    private String packedAreaCode;
    private String fgAreaCode;
    private String allowedWarehouseCodes;
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 30)
    private PacketItemType itemType = PacketItemType.NORMAL;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @PrePersist
    private void applyDefaults() {
        if (createdAt == null) createdAt = LocalDateTime.now(TimeZoneConfig.APP_ZONE);
        if (itemType == null) itemType = PacketItemType.NORMAL;
        if (totalPackets == null) totalPackets = 0;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }
    public String getPdNo() { return pdNo; }
    public void setPdNo(String pdNo) { this.pdNo = pdNo; }
    public String getDrawingName() { return drawingName; }
    public void setDrawingName(String drawingName) { this.drawingName = drawingName; }
    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getFloor() { return floor; }
    public void setFloor(String floor) { this.floor = floor; }
    public Integer getTotalPackets() { return totalPackets; }
    public void setTotalPackets(Integer totalPackets) { this.totalPackets = totalPackets; }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String plantCode) { this.plantCode = plantCode; }
    public String getPackedAreaCode() { return packedAreaCode; }
    public void setPackedAreaCode(String packedAreaCode) { this.packedAreaCode = packedAreaCode; }
    public String getFgAreaCode() { return fgAreaCode; }
    public void setFgAreaCode(String fgAreaCode) { this.fgAreaCode = fgAreaCode; }
    public String getAllowedWarehouseCodes() { return allowedWarehouseCodes; }
    public void setAllowedWarehouseCodes(String allowedWarehouseCodes) { this.allowedWarehouseCodes = allowedWarehouseCodes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public PacketItemType getItemType() { return itemType; }
    public void setItemType(PacketItemType itemType) { this.itemType = itemType; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
}
