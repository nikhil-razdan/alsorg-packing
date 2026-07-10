package com.alsorg.packing.controller.dto.admin;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminPacketRollbackHistoryResponse(
        UUID id,
        UUID packetItemId,
        String displayName,
        String fromState,
        String toState,
        String reason,
        String changedBy,
        LocalDateTime changedAt,
        String changeSummaryJson
) {
}