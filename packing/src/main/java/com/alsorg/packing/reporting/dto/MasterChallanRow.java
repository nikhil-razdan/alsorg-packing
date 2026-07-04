package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public record MasterChallanRow(
        String challanNumber,
        long itemCount,
        LocalDateTime firstDispatchedAt,
        LocalDateTime lastDispatchedAt,
        String dispatchedBy,
        String driverName,
        String vehicleNumber,
        LocalDateTime tripStartedAt,
        LocalDateTime tripEndedAt
) {
}