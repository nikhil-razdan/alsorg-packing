package com.alsorg.packing.controller.dto;
import java.time.LocalDateTime;
import java.util.UUID;
public class PacketListResponse {
    private UUID packetId;
    private String stickerNumber;
    private String companyName;
    private String status;
    private LocalDateTime createdAt;
    private String createdBy;
    private boolean stickerGenerated;
    private String floor;
    private String pdNo;
    private String drawingNo;
    private String clientName;
    private String clientAddress;
    // ===== Getters =====
    public UUID getPacketId() {
        return packetId;
    }
    public String getStickerNumber() {
        return stickerNumber;
    }
    public String getCompanyName() {
        return companyName;
    }
    public String getStatus() {
        return status;
    }
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    public String getCreatedBy() {
        return createdBy;
    }
    public boolean isStickerGenerated() {
        return stickerGenerated;
    }
    public String getFloor() {
        return floor;
    }
    public String getPdNo() {
        return pdNo;
    }
    public String getDrawingNo() {
        return drawingNo;
    }
    public String getClientName() {
        return clientName;
    }
    public String getClientAddress() {
        return clientAddress;
    }
    // ===== Setters =====
    public void setPacketId(UUID packetId) {
        this.packetId = packetId;
    }
    public void setStickerNumber(String stickerNumber) {
        this.stickerNumber = stickerNumber;
    }
    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }
    public void setStatus(String status) {
        this.status = status;
    }
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public void setStickerGenerated(boolean stickerGenerated) {
        this.stickerGenerated = stickerGenerated;
    }
    
    public void setFloor(String floor) {
        this.floor = floor;
    }
     
    public void setPdNo(String pdNo) {
        this.pdNo = pdNo;
    }
     
    public void setDrawingNo(String drawingNo) {
        this.drawingNo = drawingNo;
    }
    
    public void setClientName(String clientName) {
        this.clientName = clientName;
    }
    
    public void setClientAddress(String clientAddress) {
        this.clientAddress = clientAddress;
    }
}
