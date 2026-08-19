package com.alsorg.packing.controller.dto.client;

import java.time.LocalDateTime;
import java.util.UUID;

public record ClientMasterResponse(
        UUID id,
        String name,
        String address,
        boolean active,
        String source,
        String createdBy,
        LocalDateTime createdAt,
        String updatedBy,
        LocalDateTime updatedAt
) {
}
