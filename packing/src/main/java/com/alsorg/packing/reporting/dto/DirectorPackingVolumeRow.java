package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Sanitized packet-level physical-volume row exposed to PACKFLOW_DIRECTOR.
 *
 * Deliberately excluded from the Director contract:
 * - packedBy / createdBy user identity
 * - clientAddress
 * - admin / audit metadata
 *
 * The Director receives the operational packet identity and physical cube
 * required for management review without being granted the general Inventory
 * Reports API surface.
 */
public record DirectorPackingVolumeRow(
        UUID packetItemId,
        String zohoItemId,
        String pdNo,
        String drawingNo,
        String sku,
        String itemName,
        String description,
        String clientName,
        String plantCode,
        String floor,
        String packetNumber,
        Integer quantity,
        String dimensions,
        Double volumeCbm,
        LocalDateTime packedAt,
        String status,
        String stickerNumber
) {
}
