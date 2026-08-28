package com.alsorg.packing.domain.item;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.BatchSize;

import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.packet.Packet;
import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "packet_items", indexes = {
        @Index(name = "idx_packet_items_item_type_status", columnList = "item_type,status"),
        @Index(name = "idx_packet_items_plant_type_status", columnList = "plant_code,item_type,status"),
        @Index(name = "idx_packet_items_master_item", columnList = "master_item_id"),
        @Index(name = "idx_packet_items_creator_type", columnList = "created_by_user_id,item_type"),
        @Index(name = "idx_packet_items_master_packet", columnList = "master_item_id,packet_number"),
        @Index(name = "idx_packet_items_sticker_number", columnList = "sticker_number")
})
public class PacketItem {

    @Id
    private UUID id;

    @Column(name = "item_name", length = 500)
    private String itemName;

    @Column(name = "sku", length = 500)
    private String sku;

    @Column(name = "zoho_item_id")
    private String zohoItemId;

    private Integer quantity;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    private String location;

    @Column(name = "packed_at")
    private LocalDateTime packedAt;

    @Column(name = "floor")
    private String floor;

    private String plantCode;
    private String packedAreaCode;
    private String fgAreaCode;

    @Column(name = "allowed_warehouse_codes", columnDefinition = "TEXT")
    private String allowedWarehouseCodes;

    private String currentLocationCode;
    private String fgZoneCode;

    @Column(name = "pd_no", length = 300)
    private String pdNo;

    @Column(name = "drawing_no", length = 300)
    private String drawingNo;

    @Column(name = "client_name", length = 500)
    private String clientName;

    @Column(name = "client_address", columnDefinition = "TEXT")
    private String clientAddress;

    private String packetNumber;
    private String status;
    private String warehouseCode;
    private String gatePassNumber;
    private String fromLocation;
    private String createdBy;

    @Column(name = "sticker_number")
    private String stickerNumber;

    private String dimensions;
    private String weight;

    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 30)
    private PacketItemType itemType = PacketItemType.NORMAL;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Column(name = "packed_by", length = 150)
    private String packedBy;

    @Column(name = "linked_packet_item_id")
    private UUID linkedPacketItemId;

    @Column(name = "linked_master_item_id")
    private UUID linkedMasterItemId;

    @JsonIgnore
    @OneToMany(mappedBy = "packetItem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    @OrderBy("lineNo ASC")
    private List<HardwarePacketLine> hardwareLines = new ArrayList<>();

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "master_item_id")
    private MasterItem masterItem;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "packet_id", nullable = false)
    private Packet packet;

    @Column(name = "print_iteration")
    private Long printIteration;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getZohoItemId() { return zohoItemId; }
    public void setZohoItemId(String zohoItemId) { this.zohoItemId = zohoItemId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public LocalDateTime getPackedAt() { return packedAt; }
    public void setPackedAt(LocalDateTime packedAt) { this.packedAt = packedAt; }
    public String getFloor() { return floor; }
    public void setFloor(String floor) { this.floor = floor; }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String plantCode) { this.plantCode = plantCode; }
    public String getPackedAreaCode() { return packedAreaCode; }
    public void setPackedAreaCode(String packedAreaCode) { this.packedAreaCode = packedAreaCode; }
    public String getFgAreaCode() { return fgAreaCode; }
    public void setFgAreaCode(String fgAreaCode) { this.fgAreaCode = fgAreaCode; }
    public String getAllowedWarehouseCodes() { return allowedWarehouseCodes; }
    public void setAllowedWarehouseCodes(String allowedWarehouseCodes) { this.allowedWarehouseCodes = allowedWarehouseCodes; }
    public String getCurrentLocationCode() { return currentLocationCode; }
    public void setCurrentLocationCode(String currentLocationCode) { this.currentLocationCode = currentLocationCode; }
    public String getFgZoneCode() { return fgZoneCode; }
    public void setFgZoneCode(String fgZoneCode) { this.fgZoneCode = fgZoneCode; }
    public String getPdNo() { return pdNo; }
    public void setPdNo(String pdNo) { this.pdNo = pdNo; }
    public String getDrawingNo() { return drawingNo; }
    public void setDrawingNo(String drawingNo) { this.drawingNo = drawingNo; }
    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }
    public String getClientAddress() { return clientAddress; }
    public void setClientAddress(String clientAddress) { this.clientAddress = clientAddress; }
    public String getPacketNumber() { return packetNumber; }
    public void setPacketNumber(String packetNumber) { this.packetNumber = packetNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getWarehouseCode() { return warehouseCode; }
    public void setWarehouseCode(String warehouseCode) { this.warehouseCode = warehouseCode; }
    public String getGatePassNumber() { return gatePassNumber; }
    public void setGatePassNumber(String gatePassNumber) { this.gatePassNumber = gatePassNumber; }
    public String getFromLocation() { return fromLocation; }
    public void setFromLocation(String fromLocation) { this.fromLocation = fromLocation; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getStickerNumber() { return stickerNumber; }
    public void setStickerNumber(String stickerNumber) { this.stickerNumber = stickerNumber; }
    public String getDimensions() { return dimensions; }
    public void setDimensions(String dimensions) { this.dimensions = dimensions; }
    public String getWeight() { return weight; }
    public void setWeight(String weight) { this.weight = weight; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public PacketItemType getItemType() { return itemType; }
    public void setItemType(PacketItemType itemType) { this.itemType = itemType; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getPackedBy() { return packedBy; }
    public void setPackedBy(String packedBy) { this.packedBy = packedBy; }
    public UUID getLinkedPacketItemId() { return linkedPacketItemId; }
    public void setLinkedPacketItemId(UUID linkedPacketItemId) { this.linkedPacketItemId = linkedPacketItemId; }
    public UUID getLinkedMasterItemId() { return linkedMasterItemId; }
    public void setLinkedMasterItemId(UUID linkedMasterItemId) { this.linkedMasterItemId = linkedMasterItemId; }
    public MasterItem getMasterItem() { return masterItem; }
    public void setMasterItem(MasterItem masterItem) { this.masterItem = masterItem; }
    public Packet getPacket() { return packet; }
    public void setPacket(Packet packet) { this.packet = packet; }
    public Long getPrintIteration() { return printIteration; }
    public void setPrintIteration(Long printIteration) { this.printIteration = printIteration; }

    public List<HardwarePacketLine> getHardwareLines() {
        if (hardwareLines == null) hardwareLines = new ArrayList<>();
        return hardwareLines;
    }

    public void setHardwareLines(List<HardwarePacketLine> hardwareLines) {
        replaceHardwareLines(hardwareLines);
    }

    public void addHardwareLine(HardwarePacketLine line) {
        if (line == null) return;
        line.setPacketItem(this);
        getHardwareLines().add(line);
    }

    public void replaceHardwareLines(List<HardwarePacketLine> lines) {
        List<HardwarePacketLine> target = getHardwareLines();
        target.clear();
        if (lines == null) return;
        for (HardwarePacketLine line : lines) addHardwareLine(line);
    }

    @PrePersist
    @PreUpdate
    private void applyPacketItemDefaults() {
        if (itemType == null) itemType = PacketItemType.NORMAL;
        if (quantity == null) quantity = 1;
        if (hardwareLines == null) hardwareLines = new ArrayList<>();
    }
}
