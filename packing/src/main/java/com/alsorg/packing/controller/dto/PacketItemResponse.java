package com.alsorg.packing.controller.dto;

import java.util.UUID;

public class PacketItemResponse {

    private UUID itemId;
    private String itemName;
    private String sku;
    private String zohoItemId;
    private int quantity;
    private String description;
    private String location;
    private String floor;
    private String pdNo;
    private String drawingNo;
    private String clientName;
    private String clientAddress;
    private String stickerNumber;
    private String dimensions;
    private String weight;
    private String remarks;
    private UUID masterItemId;
    private int totalPackets;
    private String createdBy;

    public PacketItemResponse() {
    }

    public UUID getItemId() {
        return itemId;
    }

    public void setItemId(UUID itemId) {
        this.itemId = itemId;
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

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
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
	
	 public UUID getMasterItemId() {
	        return masterItemId;
	    }

	    public void setMasterItemId(UUID masterItemId) {
	        this.masterItemId = masterItemId;
	    }

		public int getTotalPackets() {
			return totalPackets;
		}

		public void setTotalPackets(int totalPackets) {
			this.totalPackets = totalPackets;
		}

		public String getCreatedBy() {
			return createdBy;
		}

		public void setCreatedBy(String createdBy) {
			this.createdBy = createdBy;
		}
}
