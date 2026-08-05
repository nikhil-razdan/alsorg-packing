package com.alsorg.packing.controller.dto.dispatch;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public record AdminBulkDispatchEditRequest(

        @NotEmpty @Size(max = 500) List<String> itemIds,

        @NotEmpty Set<AdminDispatchEditField> fields,

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
        String vehicleNumber) {
}