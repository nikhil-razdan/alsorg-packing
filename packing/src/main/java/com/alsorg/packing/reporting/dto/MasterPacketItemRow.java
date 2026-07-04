package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record MasterPacketItemRow(
        UUID packetItemId,
        UUID packetId,
        String packetNumber,
        String itemName,
        String sku,
        String pdNo,
        String drawingNo,
        String description,
        Integer quantity,
        String status,
        String stickerNumber,
        Long printIteration,
        LocalDateTime packedAt,
        String createdBy,
        String warehouseCode,
        String currentLocationCode,
        String plantCode,
        long stickerHistoryCount,
        LocalDateTime lastStickerGeneratedAt,
        String lastStickerGeneratedBy,
        String challanNumber,
        LocalDateTime dispatchedAt,
        String dispatchedBy,
        String dispatchStatus,
        String driverName,
        String vehicleNumber,
        LocalDateTime tripStartedAt,
        LocalDateTime tripEndedAt
) {
}