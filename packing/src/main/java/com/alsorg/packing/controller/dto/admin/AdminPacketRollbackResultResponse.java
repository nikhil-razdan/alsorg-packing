package com.alsorg.packing.controller.dto.admin;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AdminPacketRollbackResultResponse(
        UUID packetItemId,

        String itemName,
        String packetNumber,

        String previousState,
        String previousStateLabel,

        String currentState,
        String currentStateLabel,

        String currentStatus,
        String currentLocation,

        String changedBy,
        LocalDateTime changedAt,

        UUID auditId,

        List<String> completedChanges,

        String message
) {
}