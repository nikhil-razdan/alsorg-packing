package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record MasterItemReportRow(
        UUID masterItemId,

        String itemName,
        String pdNo,
        String drawingName,
        String clientName,
        String clientAddress,

        String floor,
        String plantCode,
        String packedAreaCode,
        String fgAreaCode,
        String allowedWarehouseCodes,

        Integer expectedPackets,
        Long actualPackets,
        Long packetItems,

        Long packedPacketItems,
        Long pendingPacketItems,
        Long dispatchedPacketItems,

        Long stickerCount,
        Long challanCount,

        Double packingProgress,

        String packingStatus,
        String latestStatus,

        LocalDateTime createdAt,
        LocalDateTime firstPackedAt,
        LocalDateTime lastPackedAt,
        LocalDateTime firstDispatchedAt,
        LocalDateTime lastDispatchedAt,

        String lastPackedBy,
        String lastDispatchedBy,

        String exceptionReason
) {
}