package com.alsorg.packing.controller.dto.admin;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record AdminPacketRollbackPreviewResponse(
        UUID packetItemId,
        String itemName,
        String description,
        String packetNumber,
        String sku,
        String pdNo,
        String drawingNo,
        String currentLifecycleState,
        String currentLifecycleLabel,
        String previousLifecycleState,
        String previousLifecycleLabel,
        String persistedPacketStatus,
        String persistedDispatchStatus,
        String currentLocation,
        String previousLocation,
        String stickerNumber,
        String gatePassNumber,
        String challanNumber,
        String requiredConfirmation,
        boolean rollbackAllowed,
        List<String> changes,
        List<String> preservedHistory,
        Map<String, Long> affectedRecords,
        String warning) {
}
