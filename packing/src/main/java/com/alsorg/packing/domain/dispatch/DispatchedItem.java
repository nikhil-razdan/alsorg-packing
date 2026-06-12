package com.alsorg.packing.domain.dispatch;

import java.time.LocalDateTime;
import java.util.UUID;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import jakarta.persistence.*;

@Entity
@Table(name = "dispatched_items")
public class DispatchedItem {

    @Id
    @Column(name = "zoho_item_id", nullable = false)
    private String zohoItemId;
    private UUID packetItemId;
    private String stickerNumber;
    private UUID packetId;
    private String location;
    private String weight;
    private String dimensions;
    @Column(nullable = false)
    private String name;

    @Column(nullable = true)
    private String sku;

    private String plantCode;
    private String packedAreaCode;
    private String fgAreaCode;
    private String allowedWarehouseCodes;
    private String currentLocationCode;
    private String fgZoneCode;
    
    @Column(name = "client_name")
    private String clientName;
    private Integer quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItemDispatchStatus status;

    @Column(name = "packed_at")
    private LocalDateTime packedAt;
    
    private LocalDateTime createdAt;

    
    @Column(nullable = false)
    private Integer stock = 0; // 🔥 default to avoid null violations

    /* ===================== RESTORE / APPROVAL ===================== */

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status")
    private ApprovalStatus approvalStatus;

    @Column(name = "approval_requested_by")
    private String approvalRequestedBy;

    @Column(name = "approval_requested_at")
    private LocalDateTime approvalRequestedAt;
    
    private String packedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "restore_requested", nullable = false)
    private boolean restoreRequested = false;

    @Column(name = "requested_by")
    private String requestedBy;

    @Column(name = "requested_at")
    private LocalDateTime requestedAt;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    /* ===================== DISPATCH ===================== */

    @Column(name = "dispatched_by")
    private String dispatchedBy;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;
    
    @Column(name = "floor_location")
    private String floorLocation;
    
    @Column(name = "warehouse_code")
    private String warehouseCode;

    private LocalDateTime movedToFloorAt;
    
    private LocalDateTime storedAt;

    private String chalaanNumber;
    
    @Column(name = "factory_floor")
    private String factoryFloor;
    
    private String description;
    private String clientAddress;
    private String drawingNo;
    private String remarks;
    private String floor;
    private String pdNo;
    private String gatePassNumber;
    private String fromLocation;
    private String createdBy;
    private UUID logisticsTripId;

    private UUID driverId;

    private String driverName;

    private UUID vehicleId;

    private String vehicleNumber;

    private LocalDateTime tripStartedAt;

    private LocalDateTime tripEndedAt;

    private LocalDateTime deliveredAt;
    
    public DispatchedItem() {
    }

    /* ===================== GETTERS / SETTERS ===================== */

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
    
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

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public ItemDispatchStatus getStatus() {
        return status;
    }

    public void setStatus(ItemDispatchStatus status) {
        this.status = status;
    }

    public LocalDateTime getPackedAt() {
        return packedAt;
    }

    public void setPackedAt(LocalDateTime packedAt) {
        this.packedAt = packedAt;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }

    public ApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(ApprovalStatus approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public String getApprovalRequestedBy() {
        return approvalRequestedBy;
    }

    public void setApprovalRequestedBy(String approvalRequestedBy) {
        this.approvalRequestedBy = approvalRequestedBy;
    }

    public LocalDateTime getApprovalRequestedAt() {
        return approvalRequestedAt;
    }

    public void setApprovalRequestedAt(LocalDateTime approvalRequestedAt) {
        this.approvalRequestedAt = approvalRequestedAt;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public boolean isRestoreRequested() {
        return restoreRequested;
    }

    public void setRestoreRequested(boolean restoreRequested) {
        this.restoreRequested = restoreRequested;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(LocalDateTime requestedAt) {
        this.requestedAt = requestedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public String getDispatchedBy() {
        return dispatchedBy;
    }

    public void setDispatchedBy(String dispatchedBy) {
        this.dispatchedBy = dispatchedBy;
    }

    public LocalDateTime getDispatchedAt() {
        return dispatchedAt;
    }

    public void setDispatchedAt(LocalDateTime dispatchedAt) {
        this.dispatchedAt = dispatchedAt;
    }

	public String getPackedBy() {
		return packedBy;
	}

	public void setPackedBy(String packedBy) {
		this.packedBy = packedBy;
	}
	public String getFactoryFloor() {
	    return factoryFloor;
	}

	public void setFactoryFloor(String factoryFloor) {
	    this.factoryFloor = factoryFloor;
	}
	
	public String getFloorLocation() { return floorLocation; }
	public void setFloorLocation(String floorLocation) { this.floorLocation = floorLocation; }

	public String getWarehouseCode() { return warehouseCode; }
	public void setWarehouseCode(String warehouseCode) { this.warehouseCode = warehouseCode; }

	public LocalDateTime getMovedToFloorAt() { return movedToFloorAt; }
	public void setMovedToFloorAt(LocalDateTime movedToFloorAt) { this.movedToFloorAt = movedToFloorAt; }

	public LocalDateTime getStoredAt() { return storedAt; }
	public void setStoredAt(LocalDateTime storedAt) { this.storedAt = storedAt; }

	public String getChalaanNumber() { return chalaanNumber; }
	public void setChalaanNumber(String chalaanNumber) { this.chalaanNumber = chalaanNumber; }

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getClientAddress() {
		return clientAddress;
	}

	public void setClientAddress(String clientAddress) {
		this.clientAddress = clientAddress;
	}

	public String getDrawingNo() {
		return drawingNo;
	}

	public void setDrawingNo(String drawingNo) {
		this.drawingNo = drawingNo;
	}

	public String getRemarks() {
		return remarks;
	}

	public void setRemarks(String remarks) {
		this.remarks = remarks;
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

	public String getLocation() {
		return location;
	}

	public void setLocation(String location) {
		this.location = location;
	}

	public String getStickerNumber() {
		return stickerNumber;
	}

	public void setStickerNumber(String stickerNumber) {
		this.stickerNumber = stickerNumber;
	}

	public UUID getPacketItemId() {
		return packetItemId;
	}

	public void setPacketItemId(UUID packetItemId) {
		this.packetItemId = packetItemId;
	}

	public UUID getPacketId() {
		return packetId;
	}

	public void setPacketId(UUID packetId) {
		this.packetId = packetId;
	}

	public Integer getQuantity() {
		// TODO Auto-generated method stub
		return quantity;
	}

	public void setQuantity(Integer quantity) {
		this.quantity = quantity;
	}

	public String getWeight() {
		return weight;
	}

	public void setWeight(String weight) {
		this.weight = weight;
	}

	public String getDimensions() {
		return dimensions;
	}

	public void setDimensions(String dimensions) {
		this.dimensions = dimensions;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(LocalDateTime createdAt) {
		this.createdAt = createdAt;
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

	public UUID getLogisticsTripId() {
		return logisticsTripId;
	}

	public void setLogisticsTripId(UUID logisticsTripId) {
		this.logisticsTripId = logisticsTripId;
	}

	public UUID getDriverId() {
		return driverId;
	}

	public void setDriverId(UUID driverId) {
		this.driverId = driverId;
	}

	public String getDriverName() {
		return driverName;
	}

	public void setDriverName(String driverName) {
		this.driverName = driverName;
	}

	public UUID getVehicleId() {
		return vehicleId;
	}

	public void setVehicleId(UUID vehicleId) {
		this.vehicleId = vehicleId;
	}

	public String getVehicleNumber() {
		return vehicleNumber;
	}

	public void setVehicleNumber(String vehicleNumber) {
		this.vehicleNumber = vehicleNumber;
	}

	public LocalDateTime getTripStartedAt() {
		return tripStartedAt;
	}

	public void setTripStartedAt(LocalDateTime tripStartedAt) {
		this.tripStartedAt = tripStartedAt;
	}

	public LocalDateTime getTripEndedAt() {
		return tripEndedAt;
	}

	public void setTripEndedAt(LocalDateTime tripEndedAt) {
		this.tripEndedAt = tripEndedAt;
	}

	public LocalDateTime getDeliveredAt() {
		return deliveredAt;
	}

	public void setDeliveredAt(LocalDateTime deliveredAt) {
		this.deliveredAt = deliveredAt;
	}
}
