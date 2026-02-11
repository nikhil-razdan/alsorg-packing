package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public class PackingReportRow {

    private String zohoItemId;
    private String itemName;
    private String clientName;
    private LocalDateTime packedAt;
    private String packedBy;

    public PackingReportRow(
            String zohoItemId,
            String itemName,
            String clientName,
            LocalDateTime packedAt,
            String packedBy
    ) {
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.clientName = clientName;
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

    public LocalDateTime getPackedAt() {
        return packedAt;
    }

    public String getPackedBy() {
        return packedBy;
    }
}
