package com.alsorg.packing.domain.sticker;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "zoho_stickers")
public class ZohoSticker {

    @Id
    private String zohoItemId;

    private String stickerNumber;

    private LocalDateTime generatedAt;

    // ---------- getters & setters ----------

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
}
