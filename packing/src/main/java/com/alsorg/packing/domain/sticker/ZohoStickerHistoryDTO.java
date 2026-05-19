package com.alsorg.packing.domain.sticker;

import java.time.LocalDateTime;

public class ZohoStickerHistoryDTO {

    private String id;
    private String stickerNumber;
    private String zohoItemId;
    private LocalDateTime generatedAt;
    private String generatedBy;
    private String generatedRole;
    private String reason;

    public ZohoStickerHistoryDTO() {}

    public ZohoStickerHistoryDTO(
            String id,
            String stickerNumber,
            String zohoItemId,
            LocalDateTime generatedAt,
            String generatedBy,
            String generatedRole,
            String reason
    ) {
        this.id = id;
        this.stickerNumber = stickerNumber;
        this.zohoItemId = zohoItemId;
        this.generatedAt = generatedAt;
        this.generatedBy = generatedBy;
        this.generatedRole = generatedRole;
        this.reason = reason;
    }

    // getters
    public String getId() { return id; }
    public String getStickerNumber() { return stickerNumber; }
    public String getZohoItemId() { return zohoItemId; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public String getGeneratedBy() { return generatedBy; }
    public String getGeneratedRole() { return generatedRole; }
    public String getReason() { return reason; }
}