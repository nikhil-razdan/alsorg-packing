package com.alsorg.packing.domain.sticker;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "zoho_sticker_history")
public class ZohoStickerHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String zohoItemId;

    @Column(nullable = false)
    private String stickerNumber;

    @Column(nullable = false)
    private String filePath;

    @Column(nullable = false)
    private LocalDateTime generatedAt;

    private String generatedBy;
    private String generatedRole;
    private String reason;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getZohoItemId() { return zohoItemId; }
    public void setZohoItemId(String zohoItemId) { this.zohoItemId = zohoItemId; }
    public String getStickerNumber() { return stickerNumber; }
    public void setStickerNumber(String stickerNumber) { this.stickerNumber = stickerNumber; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public String getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(String generatedBy) { this.generatedBy = generatedBy; }
    public String getGeneratedRole() { return generatedRole; }
    public void setGeneratedRole(String generatedRole) { this.generatedRole = generatedRole; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
