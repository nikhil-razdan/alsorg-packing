package com.alsorg.packing.controller.dto.hardware;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class HardwarePacketDtos {

    private HardwarePacketDtos() {
    }

    public record HardwareLineRequest(
            String itemName,
            BigDecimal quantity,
            String uom) {
    }

    public record HardwarePacketDraftRequest(
            List<HardwareLineRequest> items) {
    }

    public record HardwarePacketCreateRequest(
            String itemName,
            String pdNo,
            String drawingNo,
            String clientName,
            String clientAddress,
            String floor,
            String plantCode,
            List<HardwarePacketDraftRequest> packets) {
    }

    public record HardwarePacketUpdateRequest(
            String itemName,
            String pdNo,
            String drawingNo,
            String clientName,
            String clientAddress,
            String floor,
            List<HardwareLineRequest> items) {
    }

    public record HardwareLineResponse(
            UUID id,
            int serialNumber,
            String itemName,
            BigDecimal quantity,
            String uom) {
    }

    public record HardwarePacketResponse(
            UUID itemId,
            UUID masterItemId,
            String itemName,
            String packetNumber,
            String sku,
            String pdNo,
            String drawingNo,
            String clientName,
            String clientAddress,
            String floor,
            String plantCode,
            String location,
            String status,
            String stickerNumber,
            Long printIteration,
            String createdBy,
            Long createdByUserId,
            List<HardwareLineResponse> items) {
    }
}