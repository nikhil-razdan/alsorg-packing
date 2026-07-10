package com.alsorg.packing.controller.dto.challan;

import java.time.LocalDateTime;
import java.util.List;

public record CustomChallanRequest(
        String challanType,
        String fromLocation,
        String toLocation,
        String pdNo,
        String clientName,
        String clientAddress,
        String purpose,
        String movementMode,
        String driverName,
        String vehicleNumber,
        String handedOverTo,
        LocalDateTime dispatchTime,
        List<CustomChallanItemRequest> items
) {
}