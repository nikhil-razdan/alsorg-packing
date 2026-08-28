package com.alsorg.packing.controller.dto.admin;

import java.util.Map;

public record AdminDeletePreviewResponse(
        String targetType,
        String targetId,
        String displayName,
        String description,
        String pdNo,
        String drawingNo,
        String packetNumber,
        String currentStatus,
        String currentLocation,
        String requiredConfirmation,
        Map<String, Long> affectedRows,
        boolean deletesMasterItem,
        boolean deletesInternalPacket,
        String warning) {
}
