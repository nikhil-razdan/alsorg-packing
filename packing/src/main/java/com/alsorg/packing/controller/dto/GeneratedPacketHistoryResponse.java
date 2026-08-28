package com.alsorg.packing.controller.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class GeneratedPacketHistoryResponse {

    private UUID historyId;
    private UUID packetItemId;

    private String stickerNumber;
    private Long printIteration;
    private String reason;
    private LocalDateTime generatedAt;
    private String generatedBy;

    private String itemName;
    private String sku;
    private String pdNo;
    private String drawingNo;
    private String clientName;
    private String description;
    private String packetNumber;
    private String floor;
    private String weight;
    private String dimensions;
    private String remarks;

    public GeneratedPacketHistoryResponse(
            UUID historyId,
            UUID packetItemId,
            String stickerNumber,
            Long printIteration,
            String reason,
            LocalDateTime generatedAt,
            String generatedBy,
            String itemName,
            String sku,
            String pdNo,
            String drawingNo,
            String clientName,
            String description,
            String packetNumber,
            String floor,
            String weight,
            String dimensions,
            String remarks
    ) {
        this.historyId = historyId;
        this.packetItemId = packetItemId;
        this.stickerNumber = stickerNumber;
        this.printIteration = printIteration;
        this.reason = reason;
        this.generatedAt = generatedAt;
        this.generatedBy = generatedBy;
        this.itemName = itemName;
        this.sku = sku;
        this.pdNo = pdNo;
        this.drawingNo = drawingNo;
        this.clientName = clientName;
        this.description = description;
        this.packetNumber = packetNumber;
        this.floor = floor;
        this.weight = weight;
        this.dimensions = dimensions;
        this.remarks = remarks;
    }

    public UUID getHistoryId() {
        return historyId;
    }

    public UUID getPacketItemId() {
        return packetItemId;
    }

    public String getStickerNumber() {
        return stickerNumber;
    }

    public Long getPrintIteration() {
        return printIteration;
    }

    public String getReason() {
        return reason;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public String getGeneratedBy() {
        return generatedBy;
    }

    public String getItemName() {
        return itemName;
    }

    public String getSku() {
        return sku;
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

    public String getDescription() {
        return description;
    }

    public String getPacketNumber() {
        return packetNumber;
    }

    public String getFloor() {
        return floor;
    }

    public String getWeight() {
        return weight;
    }

    public String getDimensions() {
        return dimensions;
    }

    public String getRemarks() {
        return remarks;
    }
}
