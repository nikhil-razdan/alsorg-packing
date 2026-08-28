package com.alsorg.packing.domain.imports;

public class ImportPreviewRow {

    private String zohoItemId;
    private String warehouseCode;
    private String gatePass;
    private String location;
    private boolean valid;
    private String error;

    public String getZohoItemId() { return zohoItemId; }
    public void setZohoItemId(String zohoItemId) { this.zohoItemId = zohoItemId; }
    public String getWarehouseCode() { return warehouseCode; }
    public void setWarehouseCode(String warehouseCode) { this.warehouseCode = warehouseCode; }
    public String getGatePass() { return gatePass; }
    public void setGatePass(String gatePass) { this.gatePass = gatePass; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
