package com.alsorg.packing.service.pdf;

public class ChalaanItem {

    private String description;
    private String qty;
    private String remarks;

    private String itemName;
    private String drawingNo;
    
    private String zohoItemId;
    private String clientAddress;
    private String pdNo;
    private String clientName;
    // ================= GETTERS =================

    public String getDescription() {
        return description;
    }

    public String getQty() {
        return qty;
    }

    public String getRemarks() {
        return remarks;
    }

    // ================= SETTERS =================

    public void setDescription(String description) {
        this.description = description;
    }

    public void setQty(String qty) {
        this.qty = qty;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

	public String getItemName() {
		return itemName;
	}

	public void setItemName(String itemName) {
		this.itemName = itemName;
	}

	public String getDrawingNo() {
		return drawingNo;
	}

	public void setDrawingNo(String drawingNo) {
		this.drawingNo = drawingNo;
	}

	public String getZohoItemId() {
		return zohoItemId;
	}

	public void setZohoItemId(String zohoItemId) {
		this.zohoItemId = zohoItemId;
	}

	public String getClientAddress() {
		return clientAddress;
	}

	public void setClientAddress(String clientAddress) {
		this.clientAddress = clientAddress;
	}

	public String getPdNo() {
		return pdNo;
	}

	public void setPdNo(String pdNo) {
		this.pdNo = pdNo;
	}

	public String getClientName() {
		return clientName;
	}

	public void setClientName(String clientName) {
		this.clientName = clientName;
	}
}