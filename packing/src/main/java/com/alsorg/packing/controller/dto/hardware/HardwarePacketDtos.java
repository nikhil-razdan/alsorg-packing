package com.alsorg.packing.controller.dto.hardware;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.alsorg.packing.domain.common.PacketItemType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public final class HardwarePacketDtos {

    private HardwarePacketDtos() {
    }

    public record HardwareLineRequest(
            @Size(max = 300, message = "Hardware item name is too long")
            String itemName,
            BigDecimal quantity,
            @Size(max = 32, message = "UOM is too long")
            String uom) {
    }

    public record HardwarePacketDraftRequest(
            @Valid
            @NotEmpty(message = "At least one hardware line is required")
            @Size(max = 8, message = "A hardware packet can contain at most 8 lines")
            List<HardwareLineRequest> items) {
    }

    public record HardwarePacketCreateRequest(
            @Size(max = 500, message = "Hardware packet title is too long")
            String itemName,
            @Size(max = 200, message = "PD number is too long")
            String pdNo,
            @Size(max = 200, message = "Drawing number is too long")
            String drawingNo,
            @Size(max = 300, message = "Client name is too long")
            String clientName,
            @Size(max = 2000, message = "Client address is too long")
            String clientAddress,
            @Size(max = 100, message = "Floor value is too long")
            String floor,
            @Size(max = 32, message = "Plant code is too long")
            String plantCode,
            @Size(max = 10, message = "Packing date must use yyyy-MM-dd")
            String packingDate,
            @Valid
            @NotEmpty(message = "At least one hardware packet is required")
            @Size(max = 50, message = "A maximum of 50 hardware packets can be created at once")
            List<HardwarePacketDraftRequest> packets) {
    }

    public record HardwarePacketAddRequest(
            @Valid
            @NotEmpty(message = "At least one hardware packet is required")
            @Size(max = 50, message = "A maximum of 50 hardware packets can be added at once")
            List<HardwarePacketDraftRequest> packets) {
    }

    public record HardwarePacketUpdateRequest(
            @Size(max = 500, message = "Hardware packet title is too long")
            String itemName,
            @Size(max = 200, message = "PD number is too long")
            String pdNo,
            @Size(max = 200, message = "Drawing number is too long")
            String drawingNo,
            @Size(max = 300, message = "Client name is too long")
            String clientName,
            @Size(max = 2000, message = "Client address is too long")
            String clientAddress,
            @Size(max = 100, message = "Floor value is too long")
            String floor,
            @Valid
            @NotEmpty(message = "At least one hardware line is required")
            @Size(max = 8, message = "A hardware packet can contain at most 8 lines")
            List<HardwareLineRequest> items) {
    }

    public record HardwareLineResponse(
            UUID id,
            int lineNo,
            String itemName,
            BigDecimal quantity,
            String uom) {
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
            List<HardwareLineResponse> items) {
    }
}
