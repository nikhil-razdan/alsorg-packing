package com.alsorg.packing.controller.dto.challan;

import java.time.LocalDateTime;
import java.util.List;

public record CustomChallanRequest(
        String challanType,
        String fromLocation,
        String toLocation,
        String pdNo,
        String projectName,
        String clientName,
        String clientAddress,
        String purpose,
        String movementMode,
        LocalDateTime dispatchTime,
        List<CustomChallanItemRequest> items
) {
}