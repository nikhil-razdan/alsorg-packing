package com.alsorg.packing.domain.item;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

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
    private LocalDateTime createdAt = LocalDateTime.now();
    
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

	public String getPdNo() {
		return pdNo;
	}

	public void setPdNo(String pdNo) {
		this.pdNo = pdNo;
	}

	public String getDrawingName() {
		return drawingName;
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

	public void setDrawingName(String drawingName) {
		this.drawingName = drawingName;
	}

	public String getClientName() {
		return clientName;
	}

	public void setClientName(String clientName) {
		this.clientName = clientName;
	}

	public String getAddress() {
		return address;
	}

	public void setAddress(String address) {
		this.address = address;
	}

	public Integer getTotalPackets() {
		return totalPackets;
	}

	public void setTotalPackets(Integer totalPackets) {
		this.totalPackets = totalPackets;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(LocalDateTime createdAt) {
		this.createdAt = createdAt;
	}

	public String getFloor() {
		return floor;
	}

	public void setFloor(String floor) {
		this.floor = floor;
	}
}