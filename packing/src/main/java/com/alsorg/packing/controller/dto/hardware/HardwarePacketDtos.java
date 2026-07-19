package com.alsorg.packing.controller.dto.hardware;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.alsorg.packing.domain.common.PacketItemType;

public final class HardwarePacketDtos {

    private HardwarePacketDtos() {
    }

    public record HardwareLineRequest(
            String itemName,
            BigDecimal quantity,
            String uom
    ) {
    }

    public record HardwarePacketDraftRequest(
            List<HardwareLineRequest> items
    ) {
    }

    public record HardwarePacketCreateRequest(
            String itemName,
            String pdNo,
            String drawingNo,
            String clientName,
            String clientAddress,
            String floor,
            String plantCode,
            List<HardwarePacketDraftRequest> packets
    ) {
    }

    /*
     * Used when adding Packet 2, Packet 3, etc.
     * Master-level information comes from the existing MasterItem.
     */
    public record HardwarePacketAddRequest(
            List<HardwarePacketDraftRequest> packets
    ) {
    }

    public record HardwarePacketUpdateRequest(
            String itemName,
            String pdNo,
            String drawingNo,
            String clientName,
            String clientAddress,
            String floor,
            List<HardwareLineRequest> items
    ) {
    }

    public record HardwareLineResponse(
            UUID id,
            int lineNo,
            String itemName,
            BigDecimal quantity,
            String uom
    ) {
    }

    public record HardwarePacketResponse(
            UUID itemId,
            UUID masterItemId,

            PacketItemType itemType,

            String itemName,
            String packetNumber,
            String sku,

            String pdNo,
            String drawingNo,

            String clientName,
            String clientAddress,
            String floor,

            String description,

            String plantCode,
            String location,
            String packedAreaCode,
            String currentLocationCode,

            String status,
            String stickerNumber,
            Long printIteration,

            String createdBy,
            Long createdByUserId,

            List<HardwareLineResponse> items
    ) {
    }
}