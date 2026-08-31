package com.alsorg.packing.service.pdf;

/**
 * Lightweight row model used while building challan PDFs.
 *
 * packetNumber and sku are additive presentation fields only. They allow the
 * challan renderer to print the real PacketItem packet identity entered by the
 * Packing user instead of inventing a 1..N sequence inside a grouped item.
 *
 * No packing, dispatch, warehouse, logistics or lifecycle workflow state is
 * changed by these fields.
 */
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

    /*
     * Canonical packet identity copied from PacketItem.packetNumber
     * (for example "Pkt-1", "Pkt-79", "Pkt-104").
     *
     * sku is retained only as a read-only fallback for historical rows where
     * the packet number can still be recovered from ".../Pkt-N".
     */
    private String packetNumber;
    private String sku;

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

    public String getItemName() {
        return itemName;
    }

    public String getDrawingNo() {
        return drawingNo;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public String getClientAddress() {
        return clientAddress;
    }

    public String getPdNo() {
        return pdNo;
    }

    public String getClientName() {
        return clientName;
    }

    public String getPacketNumber() {
        return packetNumber;
    }

    public String getSku() {
        return sku;
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

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public void setDrawingNo(String drawingNo) {
        this.drawingNo = drawingNo;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public void setClientAddress(String clientAddress) {
        this.clientAddress = clientAddress;
    }

    public void setPdNo(String pdNo) {
        this.pdNo = pdNo;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public void setPacketNumber(String packetNumber) {
        this.packetNumber = packetNumber;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }
}
