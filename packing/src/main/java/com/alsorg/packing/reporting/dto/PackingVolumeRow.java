package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Packet-level source row for volume/productivity reporting.
 *
 * volumeCbm is the physical external volume of the packet represented by this
 * row. It is intentionally not multiplied by quantity because one packet row
 * is one physical packed unit whose L x B x H dimensions define its occupied
 * cubic volume.
 */
public record PackingVolumeRow(
        UUID packetItemId,
        String zohoItemId,
        String pdNo,
        String drawingNo,
        String sku,
        String itemName,
        String description,
        String clientName,
        String clientAddress,
        String plantCode,
        String floor,
        String packetNumber,
        Integer quantity,
        String dimensions,
        Double volumeCbm,
        LocalDateTime packedAt,
        String packedBy,
        String status,
        String stickerNumber
) {
    public boolean hasVolume() {
        return volumeCbm != null && volumeCbm >= 0d;
    }
}
