package com.alsorg.packing.controller.dto.admin;

public record AdminDeleteSearchResult(
        String type,
        String id,
        String masterItemId,
        String itemName,
        String pdNo,
        String drawingNo,
        String packetNumber,
        String sku,
        String stickerNumber,
        String status,
        String location,
        String plantCode,
        Integer totalPackets
) {
}