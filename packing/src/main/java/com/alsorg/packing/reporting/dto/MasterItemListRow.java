package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record MasterItemListRow(
        UUID masterItemId,
        String itemName,
        String pdNo,
        String drawingName,
        String clientName,
        String clientAddress,
        String floor,
        String plantCode,
        Integer expectedPackets,
        long actualPackets,
        long packetItems,
        long packedPacketItems,
        long pendingPacketItems,
        long dispatchedPacketItems,
        long stickerCount,
        long challanCount,
        double completionPercent,
        String packingStatus,
        LocalDateTime createdAt,
        LocalDateTime firstPackedAt,
        LocalDateTime lastPackedAt,
        LocalDateTime firstDispatchedAt,
        LocalDateTime lastDispatchedAt,
        String lastPackedBy,
        String lastDispatchedBy
) {
}