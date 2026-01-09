package com.alsorg.packing.controller.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class PacketDetailResponse {

    private UUID packetId;
    private String stickerNumber;
    private String companyName;
    private String status;
    private String createdBy;
    private LocalDateTime createdAt;
    private boolean stickerGenerated;
    // ✅ REQUIRED: No-args constructor
    public PacketDetailResponse() {
    }
    // ✅ Getters & Setters (ALL of them)
    public UUID getPacketId() {
        return packetId;
    }
    public void setPacketId(UUID packetId) {
        this.packetId = packetId;
    }
    public String getStickerNumber() {
        return stickerNumber;
    }
    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }
    public String getCompanyName() {
        return companyName;
    }
    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }
    public String getStatus() {
        return status;
    }
    public void setStatus(String status) {
        this.status = status;
    }
    public String getCreatedBy() {
        return createdBy;
    }
    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    public boolean isStickerGenerated() {
        return stickerGenerated;
    }
    public void setStickerGenerated(boolean stickerGenerated) {
        this.stickerGenerated = stickerGenerated;
    }
    // ✅ Mapper
    public static PacketDetailResponse from(com.alsorg.packing.domain.packet.Packet packet) {
        PacketDetailResponse dto = new PacketDetailResponse();
        dto.setPacketId(packet.getId());
        dto.setStickerNumber(packet.getStickerNumber());
        dto.setCompanyName(packet.getCompany().getName());
        dto.setStatus(packet.getStatus().name());
        dto.setCreatedBy(packet.getCreatedBy());
        dto.setCreatedAt(packet.getCreatedAt());
        dto.setStickerGenerated(packet.getStickerGenerated());
        return dto;
    }
}
