package com.alsorg.packing.controller.dto;

import java.util.UUID;

public class PacketCreateResponse {

    private UUID packetId;
    private String stickerNumber;
    private String status;

    public PacketCreateResponse(UUID packetId, String stickerNumber, String status) {
        this.packetId = packetId;
        this.stickerNumber = stickerNumber;
        this.status = status;
    }

    public UUID getPacketId() {
        return packetId;
    }

    public String getStickerNumber() {
        return stickerNumber;
    }

    public String getStatus() {
        return status;
    }
}
