package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ADMIN-only record-inspection row used by the PackFlow dashboard trace API.
 *
 * Description is intentionally a packet/item field rather than being inferred
 * from itemName. This keeps the dashboard inspector faithful to the description
 * that users entered in Packing and that is carried into Dispatch.
 */
public record DashboardTraceRow(
        String sourceType,
        String movementType,

        UUID masterItemId,
        UUID packetId,
        UUID packetItemId,

        String masterItemName,
        String itemName,
        String description,
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
