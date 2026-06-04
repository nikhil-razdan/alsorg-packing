package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public class InventoryAgingRow {

    private String zohoItemId;
    private String itemName;
    private String clientName;

    private String packetNumber;
    private String packetName;

    private String status;
    private LocalDateTime createdAt;

    private long daysInInventory;

    public InventoryAgingRow(
            String zohoItemId,
            String itemName,
            String clientName,
            long daysInInventory
    ) {
        this(
                zohoItemId,
                itemName,
                clientName,
                null,
                null,
                null,
                null,
                daysInInventory
        );
    }


    public InventoryAgingRow(
            String zohoItemId,
            String itemName,
            String clientName,
            String packetNumber,
            String packetName,
            String status,
            LocalDateTime createdAt,
            long daysInInventory
    ) {
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.clientName = clientName;
        this.packetNumber = packetNumber;
        this.packetName = packetName;
        this.status = status;
        this.createdAt = createdAt;
        this.daysInInventory = daysInInventory;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public String getItemName() {
        return itemName;
    }

    public String getClientName() {
        return clientName;
    }

    public String getPacketNumber() {
        return packetNumber;
    }

    public String getPacketName() {
        return packetName;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public long getDaysInInventory() {
        return daysInInventory;
    }
}