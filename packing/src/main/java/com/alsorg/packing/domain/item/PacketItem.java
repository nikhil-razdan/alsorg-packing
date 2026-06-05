package com.alsorg.packing.domain.item;

import java.time.LocalDateTime;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import com.alsorg.packing.domain.packet.Packet;

@Entity
@Table(name = "packet_items")
public class PacketItem {

    @Id
    private UUID id;

    private String itemName;
    private String sku;
    @Column(name = "zoho_item_id")
    private String zohoItemId; // ⚠ TEMP: will be removed later
    private Integer quantity;
    private String description;
    private String location;
    @Column(name = "packed_at")
    private LocalDateTime packedAt;
    @Column(name = "floor")
    private String floor;

    private String plantCode;
    private String packedAreaCode;
    private String fgAreaCode;
    private String allowedWarehouseCodes;
    private String currentLocationCode;
    private String fgZoneCode;
    @Column(name = "pd_no")
    private String pdNo;

    @Column(name = "drawing_no")
    private String drawingNo;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "client_address")
    private String clientAddress;
    
    private String packetNumber;   // P1, P2, etc
    private String status;         // ON_FLOOR, WAREHOUSE_REQUESTED, IN_WAREHOUSE

    private String warehouseCode;
    private String gatePassNumber;

    private String fromLocation;
    private String createdBy;
    @Column(name = "sticker_number")
    private String stickerNumber;
    private String dimensions;
    private String weight;
    private String remarks;

    @ManyToOne
    @JoinColumn(name = "master_item_id")
    private MasterItem masterItem;
    
    public String getPlantCode() {
		return plantCode;
	}

	public void setPlantCode(String plantCode) {
		this.plantCode = plantCode;
	}

	public String getPackedAreaCode() {
		return packedAreaCode;
	}

	public void setPackedAreaCode(String packedAreaCode) {
		this.packedAreaCode = packedAreaCode;
	}

	public String getFgAreaCode() {
		return fgAreaCode;
	}

	public void setFgAreaCode(String fgAreaCode) {
		this.fgAreaCode = fgAreaCode;
	}

	public String getAllowedWarehouseCodes() {
		return allowedWarehouseCodes;
	}

	public void setAllowedWarehouseCodes(String allowedWarehouseCodes) {
		this.allowedWarehouseCodes = allowedWarehouseCodes;
	}
    
    @ManyToOne
    @JoinColumn(name = "packet_id", nullable = false)
    @JsonIgnore 
    private Packet packet;

    @Column(name = "print_iteration")
    private Long printIteration;
    
    public MasterItem getMasterItem() {
        return masterItem;
    }

    public void setMasterItem(MasterItem masterItem) {
        this.masterItem = masterItem;
    }

    public Long getPrintIteration() {
        return printIteration;
    }

    public void setPrintIteration(Long printIteration) {
        this.printIteration = printIteration;
    }
    // ===== Getters & Setters =====

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Packet getPacket() {
        return packet;
    }

    public void setPacket(Packet packet) {
        this.packet = packet;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public String getPdNo() {
        return pdNo;
    }

    public void setPdNo(String pdNo) {
        this.pdNo = pdNo;
    }

    public String getDrawingNo() {
        return drawingNo;
    }

    public void setDrawingNo(String drawingNo) {
        this.drawingNo = drawingNo;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getClientAddress() {
        return clientAddress;
    }

    public void setClientAddress(String clientAddress) {
        this.clientAddress = clientAddress;
    }

	public String getPacketNumber() {
		return packetNumber;
	}

	public void setPacketNumber(String packetNumber) {
		this.packetNumber = packetNumber;
	}

	public String getStatus() {
		return status;
	}

	public void setStatus(String status) {
		this.status = status;
	}

	public String getWarehouseCode() {
		return warehouseCode;
	}

	public void setWarehouseCode(String warehouseCode) {
		this.warehouseCode = warehouseCode;
	}

	public String getGatePassNumber() {
		return gatePassNumber;
	}

	public void setGatePassNumber(String gatePassNumber) {
		this.gatePassNumber = gatePassNumber;
	}

	public String getFromLocation() {
		return fromLocation;
	}

	public void setFromLocation(String fromLocation) {
		this.fromLocation = fromLocation;
	}

	public String getCreatedBy() {
		return createdBy;
	}

	public void setCreatedBy(String createdBy) {
		this.createdBy = createdBy;
	}
	
    public String getStickerNumber() {
        return stickerNumber;
    }

    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }

	public String getDimensions() {
		return dimensions;
	}

	public void setDimensions(String dimensions) {
		this.dimensions = dimensions;
	}

	public String getWeight() {
		return weight;
	}

	public void setWeight(String weight) {
		this.weight = weight;
	}

	public String getRemarks() {
		return remarks;
	}

	public void setRemarks(String remarks) {
		this.remarks = remarks;
	}

	public LocalDateTime getPackedAt() {
		return packedAt;
	}

	public void setPackedAt(LocalDateTime packedAt) {
		this.packedAt = packedAt;
	}

	public String getCurrentLocationCode() {
		return currentLocationCode;
	}

	public void setCurrentLocationCode(String currentLocationCode) {
		this.currentLocationCode = currentLocationCode;
	}

	public String getFgZoneCode() {
		return fgZoneCode;
	}

	public void setFgZoneCode(String fgZoneCode) {
		this.fgZoneCode = fgZoneCode;
	}
}
