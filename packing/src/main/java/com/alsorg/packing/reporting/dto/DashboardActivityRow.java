package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public class DashboardActivityRow {

    private Long id;
    private String zohoItemId;
    private String itemName;
    private String action;
    private String performedBy;
    private String role;
    private LocalDateTime createdAt;

    public DashboardActivityRow(
            Long id,
            String zohoItemId,
            String itemName,
            String action,
            String performedBy,
            String role,
            LocalDateTime createdAt
    ) {
        this.id = id;
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.action = action;
        this.performedBy = performedBy;
        this.role = role;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getZohoItemId() { return zohoItemId; }
    public String getItemName() { return itemName; }
    public String getAction() { return action; }
    public String getPerformedBy() { return performedBy; }
    public String getRole() { return role; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
