package com.alsorg.packing.controller.dto.dispatch;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminUpdatedDispatchRow(
        String zohoItemId,
        String name,
        String itemName,
        String pdNo,
        String drawingNo,
        String clientName,
        String clientAddress,
        String floor,
        String description,
        String weight,
        String dimensions,
        String remarks,
        String location,
        String currentLocationCode,
        UUID driverId,
        String driverName,
        UUID vehicleId,
        String vehicleNumber,
        Integer helperLoaderCount,
        String chalaanNumber,
        String status,
        LocalDateTime dispatchedAt,
        LocalDateTime tripStartedAt,
        LocalDateTime tripEndedAt,
        LocalDateTime deliveredAt,
        LocalDateTime updatedAt) {
}
