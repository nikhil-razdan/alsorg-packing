package com.alsorg.packing.controller.dto.admin;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class PacketLifecycleRequestDtos {

    private PacketLifecycleRequestDtos() {
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
            UUID packetItemId,
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
            String requestedFromState,
            String requestedFromLabel,
            String requestedToState,
            String requestedToLabel,
            String status,
            String decidedBy,
            LocalDateTime decidedAt,
            String decisionReason,
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
