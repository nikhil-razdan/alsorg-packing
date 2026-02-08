package com.alsorg.packing.domain.sticker;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "zoho_stickers")
public class ZohoSticker {

    @Id
    @Column(name = "zoho_item_id", nullable = false)
    private String zohoItemId;

    @Column(name = "sticker_number", nullable = false)
    private String stickerNumber;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    // ✅ REQUIRED for re-download & history
    @Column(name = "file_path", nullable = false)
    private String filePath;

    public ZohoSticker() {}

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

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }
}
