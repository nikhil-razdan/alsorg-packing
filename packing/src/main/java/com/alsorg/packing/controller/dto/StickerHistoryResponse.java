package com.alsorg.packing.controller.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class StickerHistoryResponse {

    private UUID id;

    private String stickerNumber;

    private Long printIteration;

    private String reason;

    private LocalDateTime generatedAt;

    public StickerHistoryResponse(
            UUID id,
            String stickerNumber,
            Long printIteration,
            String reason,
            LocalDateTime generatedAt
    ) {
        this.id = id;
        this.stickerNumber = stickerNumber;
        this.printIteration = printIteration;
        this.reason = reason;
        this.generatedAt = generatedAt;
    }

    public StickerHistoryResponse() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getStickerNumber() {
        return stickerNumber;
    }

    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }

    public Long getPrintIteration() {
        return printIteration;
    }

    public void setPrintIteration(Long printIteration) {
        this.printIteration = printIteration;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }
}