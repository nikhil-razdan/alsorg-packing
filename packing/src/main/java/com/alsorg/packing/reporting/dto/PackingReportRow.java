package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public class PackingReportRow {

    private String zohoItemId;
    private String itemName;
    private String clientName;

    private String packetNumber;
    private String packetName;

    private LocalDateTime packedAt;
    private String packedBy;

    public PackingReportRow(
            String zohoItemId,
            String itemName,
            String clientName,
            LocalDateTime packedAt,
            String packedBy
    ) {
        this(
                zohoItemId,
                itemName,
                clientName,
                null,
                null,
                packedAt,
                packedBy
        );
    }

    public PackingReportRow(
            String zohoItemId,
            String itemName,
            String clientName,
            String packetNumber,
            String packetName,
            LocalDateTime packedAt,
            String packedBy
    ) {
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.clientName = clientName;
        this.packetNumber = packetNumber;
        this.packetName = packetName;
        this.packedAt = packedAt;
        this.packedBy = packedBy;
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

    public LocalDateTime getPackedAt() {
        return packedAt;
    }

    public String getPackedBy() {
        return packedBy;
    }
}