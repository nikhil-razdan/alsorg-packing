package com.alsorg.packing.reporting.dto;

public class InventoryAgingRow {

    private String zohoItemId;
    private String itemName;
    private String clientName;
    private long daysInInventory;

    public InventoryAgingRow(
            String zohoItemId,
            String itemName,
            String clientName,
            long daysInInventory
    ) {
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.clientName = clientName;
        this.daysInInventory = daysInInventory;
    }

    public String getZohoItemId() { return zohoItemId; }
    public String getItemName() { return itemName; }
    public String getClientName() { return clientName; }
    public long getDaysInInventory() { return daysInInventory; }
}
