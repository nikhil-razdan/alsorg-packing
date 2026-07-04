package com.alsorg.packing.reporting.dto;

public class DashboardActivityRow {

    private Long id;
    private String zohoItemId;
    private String itemName;
    private String action;
    private String performedBy;
    private String role;
    private String fromStatus;
    private String toStatus;
    private String remarks;

    /*
     * Send createdAt as ISO string with +05:30.
     * Example:
     * 2026-07-04T13:45:20+05:30
     *
     * This prevents frontend timezone confusion.
     */
    private String createdAt;

    public DashboardActivityRow(
            Long id,
            String zohoItemId,
            String itemName,
            String action,
            String performedBy,
            String role,
            String fromStatus,
            String toStatus,
            String remarks,
            String createdAt
    ) {
        this.id = id;
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.action = action;
        this.performedBy = performedBy;
        this.role = role;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.remarks = remarks;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public String getItemName() {
        return itemName;
    }

    public String getAction() {
        return action;
    }

    public String getPerformedBy() {
        return performedBy;
    }

    public String getRole() {
        return role;
    }

    public String getFromStatus() {
        return fromStatus;
    }

    public String getToStatus() {
        return toStatus;
    }

    public String getRemarks() {
        return remarks;
    }

    public String getCreatedAt() {
        return createdAt;
    }
}