package com.alsorg.packing.domain.sticker;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "zoho_sticker_history")
public class ZohoStickerHistory {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String zohoItemId;

    @Column(nullable = false)
    private String stickerNumber;

    @Column(nullable = false)
    private String filePath;

    @Column(nullable = false)
    private LocalDateTime generatedAt;

    // Who generated it
    private String generatedBy;
    private String generatedRole;

    // Why it was generated
    private String reason;

    /* ================= GETTERS / SETTERS ================= */

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public void setZohoItemId(String zohoItemId) {
        this.zohoItemId = zohoItemId;
    }

    public String getStickerNumber() {
        return stickerNumber;
    }

    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }

    public String getGeneratedBy() {
        return generatedBy;
    }

    public void setGeneratedBy(String generatedBy) {
        this.generatedBy = generatedBy;
    }

    public String getGeneratedRole() {
        return generatedRole;
    }

    public void setGeneratedRole(String generatedRole) {
        this.generatedRole = generatedRole;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
