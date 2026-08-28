package com.alsorg.packing.controller.dto.admin;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record AdminDeleteResultResponse(
        UUID deletionAuditId,
        String targetType,
        String targetId,
        String displayName,
        String deletedBy,
        LocalDateTime deletedAt,
        Map<String, Long> deletedRows,
        String message) {
}
