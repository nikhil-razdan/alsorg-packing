package com.alsorg.packing.controller.dto.site;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SiteLifecycleRow(
        UUID packetItemId,
        String zohoItemId,
        String itemName,
        String packetNumber,
        String stickerNumber,
        String sku,
        String pdNo,
        String drawingNo,
        String description,
        String clientName,
        String plantCode,
        String currentLocationCode,
        String challanNumber,
        String driverName,
        String vehicleNumber,
        LocalDateTime dispatchedAt,
        String coreStatus,
        String siteStatus,
        LocalDateTime deliveredAt,
        String deliveredBy,
        Double deliveryLatitude,
        Double deliveryLongitude,
        Double deliveryAccuracy,
        String receiverName,
        String receiverPhone,
        String deliveryRemarks,
        LocalDateTime openedAt,
        String openedBy,
        Double openingLatitude,
        Double openingLongitude,
        Double openingAccuracy,
        String openingRemarks,
        long deliveryPhotoCount,
        long openingPhotoCount,
        List<UUID> evidenceIds
) {
}
