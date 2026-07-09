package com.alsorg.packing.controller.dto.challan;

import java.time.LocalDateTime;

public record CustomChallanSummaryResponse(
        String challanNumber,
        String challanType,
        String challanTypeLabel,
        String fromLocation,
        String toLocation,
        String pdNo,
        String clientName,
        String purpose,
        String movementMode,
        String driverName,
        String vehicleNumber,
        String generatedBy,
        LocalDateTime generatedAt,
        int totalItems
) {
}