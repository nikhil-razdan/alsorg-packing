package com.alsorg.packing.service.pdf;

import java.util.List;

public class ChalaanPdfData {

    private String pdNo;
    private String customerName;
    private String address;

    private String designerName;
    private String voucherNo;
    private String ot;
    
    private String driverName;

    private String vehicleNumber;

    private List<ChalaanItem> items;

    // ================= GETTERS =================

    public String getPdNo() {
        return pdNo;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getAddress() {
        return address;
    }

    public String getDesignerName() {
        return designerName;
    }

    public String getVoucherNo() {
        return voucherNo;
    }

    public String getOt() {
        return ot;
    }

    public List<ChalaanItem> getItems() {
        return items;
    }

    // ================= SETTERS =================

    public void setPdNo(String pdNo) {
        this.pdNo = pdNo;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public void setDesignerName(String designerName) {
        this.designerName = designerName;
    }

    public void setVoucherNo(String voucherNo) {
        this.voucherNo = voucherNo;
    }

    public void setOt(String ot) {
        this.ot = ot;
    }

    public void setItems(List<ChalaanItem> items) {
        this.items = items;
    }

	public String getDriverName() {
		return driverName;
	}

	public void setDriverName(String driverName) {
		this.driverName = driverName;
	}

	public String getVehicleNumber() {
		return vehicleNumber;
	}

	public void setVehicleNumber(String vehicleNumber) {
		this.vehicleNumber = vehicleNumber;
	}
}