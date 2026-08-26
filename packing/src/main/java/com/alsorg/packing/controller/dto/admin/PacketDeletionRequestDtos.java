package com.alsorg.packing.controller.dto.admin;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class PacketDeletionRequestDtos {

    private PacketDeletionRequestDtos() {
    }

    public record SubmitRequest(
            List<String> targetIds,
            String reason,
            String source) {
    }

    public record DecisionRequest(
            List<UUID> requestIds,
            String reason) {
    }

    public record RequestResponse(
            UUID id,
            UUID requestGroupId,
            String targetType,
            String targetId,
            UUID packetItemId,
            String dispatchItemId,
            String sourceReferenceId,
            String displayName,
            String itemName,
            String packetNumber,
            String sku,
            String pdNo,
            String drawingNo,
            String plantCode,
            String source,
            String reason,
            String requestedBy,
            LocalDateTime requestedAt,
            String requestedStatus,
            String requestedLocation,
            String status,
            String decidedBy,
            LocalDateTime decidedAt,
            String decisionReason,
            UUID deletionAuditId,
            String deletionMessage,
            Long rowVersion) {
    }

    public record SubmitResponse(
            UUID requestGroupId,
            int requestedCount,
            List<RequestResponse> requests,
            String message) {
    }

    public record DecisionResponse(
            int processedCount,
            List<RequestResponse> requests,
            String message) {
    }
}
