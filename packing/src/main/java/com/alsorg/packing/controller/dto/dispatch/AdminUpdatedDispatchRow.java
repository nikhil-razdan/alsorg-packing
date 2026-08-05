package com.alsorg.packing.controller.dto.dispatch;

import java.time.LocalDateTime;

public record AdminUpdatedDispatchRow(
        String zohoItemId,

        String itemName,

        String name,

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

        String driverName,

        String vehicleNumber,

        String challanNumber,

        String status,

        LocalDateTime updatedAt) {
}