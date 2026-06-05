package com.alsorg.packing.controller.dto;

import java.util.List;

public class CreateItemRequest {

    public String itemName;
    public String pdNo;
    public String drawingNo;
    public String clientName;
    public String clientAddress;
    public String floor;

    public int numberOfPackets;   // 🔥 KEY FIELD
    private List<String> descriptions;
    public String dimensions;
    public String weight;
    public String remarks;    
    private List<String> weights;
    private List<String> dimensionsList;
    private List<String> remarksList;
    private Integer customPacketNumber;
    
    public String plantCode;

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(String plantCode) {
        this.plantCode = plantCode;
    }

    // Getters and Setters

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

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public int getNumberOfPackets() {
        return numberOfPackets;
    }

    public void setNumberOfPackets(int numberOfPackets) {
        this.numberOfPackets = numberOfPackets;
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

	public List<String> getDescriptions() {
		return descriptions;
	}

	public void setDescriptions(List<String> descriptions) {
		this.descriptions = descriptions;
	}

	public List<String> getWeights() {
		return weights;
	}

	public void setWeights(List<String> weights) {
		this.weights = weights;
	}

	public List<String> getDimensionsList() {
		return dimensionsList;
	}

	public void setDimensionsList(List<String> dimensionsList) {
		this.dimensionsList = dimensionsList;
	}

	public List<String> getRemarksList() {
		return remarksList;
	}

	public void setRemarksList(List<String> remarksList) {
		this.remarksList = remarksList;
	}

	public Integer getCustomPacketNumber() {
		return customPacketNumber;
	}

	public void setCustomPacketNumber(Integer customPacketNumber) {
		this.customPacketNumber = customPacketNumber;
	}
}