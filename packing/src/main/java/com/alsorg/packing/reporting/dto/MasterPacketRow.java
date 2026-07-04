package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record MasterPacketRow(
        UUID packetId,
        Integer packetNumber,
        String stickerNumber,
        String status,
        String factoryFloor,
        String warehouseCode,
        String gatePassNumber,
        String challanNumber,
        LocalDateTime createdAt,
        String createdBy,
        long packetItems,
        long packedItems,
        long dispatchedItems
) {
}