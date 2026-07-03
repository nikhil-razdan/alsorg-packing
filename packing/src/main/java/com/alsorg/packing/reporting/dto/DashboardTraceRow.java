package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record DashboardTraceRow(
        String sourceType,
        String movementType,

        UUID masterItemId,
        UUID packetId,
        UUID packetItemId,

        String masterItemName,
        String itemName,
        String packetNumber,

        String pdNo,
        String drawingNo,
        String sku,

        String clientName,
        String clientAddress,

        String plantCode,
        String currentLocationCode,
        String warehouseCode,

        String status,

        String stickerNumber,
        Long printIteration,

        LocalDateTime packedAt,
        String packedBy,

        LocalDateTime dispatchedAt,
        String dispatchedBy,

        String challanNumber,
        String driverName,
        String vehicleNumber,

        LocalDateTime tripStartedAt,
        LocalDateTime tripEndedAt,

        String generatedBy,
        LocalDateTime generatedAt,

        String exceptionReason
) {
}