package com.alsorg.packing.controller.dto.dispatch;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;

public record AdminBulkDispatchEditRequest(
        @NotEmpty(message = "Select at least one dispatch item") List<String> itemIds,

        @NotEmpty(message = "Select at least one field to update") Set<AdminDispatchEditField> fields,

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
        String stickerLocation,

        UUID driverId,
        String driverName,

        UUID vehicleId,
        String vehicleNumber,

        LocalDateTime dispatchDateTime) {
}