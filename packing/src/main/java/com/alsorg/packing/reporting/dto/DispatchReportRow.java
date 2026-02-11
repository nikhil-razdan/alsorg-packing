package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public class DispatchReportRow {

    private String zohoItemId;
    private String itemName;
    private String clientName;
    private LocalDateTime dispatchedAt;
    private String dispatchedBy;

    public DispatchReportRow(
            String zohoItemId,
            String itemName,
            String clientName,
            LocalDateTime dispatchedAt,
            String dispatchedBy
    ) {
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.clientName = clientName;
        this.dispatchedAt = dispatchedAt;
        this.dispatchedBy = dispatchedBy;
    }

    public String getZohoItemId() { return zohoItemId; }
    public String getItemName() { return itemName; }
    public String getClientName() { return clientName; }
    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public String getDispatchedBy() { return dispatchedBy; }
}
