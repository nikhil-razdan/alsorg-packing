package com.alsorg.packing.controller.dto.admin;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public final class PacketLifecycleRequestDtos {

    private PacketLifecycleRequestDtos() {
    }

    public record SubmitRequest(
            @NotEmpty(message = "Select at least one item")
            @Size(max = 200, message = "A maximum of 200 packet items can be requested at once")
            List<String> targetIds,

            @Size(max = 1000, message = "Reason cannot exceed 1000 characters")
            String reason,

            @Size(max = 64, message = "Source is too long")
            String source) {
    }

    public record DecisionRequest(
            @NotEmpty(message = "Select at least one pending request")
            @Size(max = 200, message = "A maximum of 200 requests can be processed at once")
            List<UUID> requestIds,

            @Size(max = 500, message = "Decision reason cannot exceed 500 characters")
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
