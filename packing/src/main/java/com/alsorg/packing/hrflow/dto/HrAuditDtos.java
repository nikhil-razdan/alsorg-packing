package com.alsorg.packing.hrflow.dto;

import com.alsorg.packing.hrflow.domain.HrAuditAction;

import java.time.LocalDateTime;
import java.util.UUID;

public final class HrAuditDtos {
    private HrAuditDtos() {}

    public record AuditResponse(
            UUID id,
            HrAuditAction action,
            String entityType,
            String entityId,
            String actor,
            String message,
            String metadataJson,
            LocalDateTime createdAt
    ) {}
}
