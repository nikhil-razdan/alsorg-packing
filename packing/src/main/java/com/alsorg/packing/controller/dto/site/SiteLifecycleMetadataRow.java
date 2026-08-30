package com.alsorg.packing.controller.dto.site;

import java.time.LocalDateTime;
import java.util.UUID;

public record SiteLifecycleMetadataRow(
        UUID packetItemId,
        String siteStatus,
        LocalDateTime deliveredAt,
        LocalDateTime openedAt,
        long deliveryPhotoCount,
        long openingPhotoCount
) {
}
