package com.alsorg.packing.domain.activity;

import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
@Table(name = "activity_logs")
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String zohoItemId;
    private String action;
    private String performedBy;
    private String role;

    private String fromStatus;
    private String toStatus;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    private LocalDateTime createdAt = LocalDateTime.now();

    /* ===== Getters & Setters ===== */

    public Long getId() { return id; }

    public String getZohoItemId() { return zohoItemId; }
    public void setZohoItemId(String zohoItemId) { this.zohoItemId = zohoItemId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getPerformedBy() { return performedBy; }
    public void setPerformedBy(String performedBy) { this.performedBy = performedBy; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String fromStatus) { this.fromStatus = fromStatus; }

    public String getToStatus() { return toStatus; }
    public void setToStatus(String toStatus) { this.toStatus = toStatus; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
