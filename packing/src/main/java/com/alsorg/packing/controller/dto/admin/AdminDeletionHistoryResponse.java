package com.alsorg.packing.controller.dto.admin;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminDeletionHistoryResponse(
        UUID id,
        String targetType,
        String targetId,
        String displayName,
        String reason,
        String deletedBy,
        LocalDateTime deletedAt,
        String affectedRowsJson) {
}
