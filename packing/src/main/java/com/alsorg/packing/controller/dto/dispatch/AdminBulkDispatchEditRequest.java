package com.alsorg.packing.controller.dto.dispatch;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public record AdminBulkDispatchEditRequest(
        @NotEmpty(message = "Select at least one dispatch item")
        @Size(max = 500, message = "A maximum of 500 dispatch items can be edited at once")
        List<String> itemIds,

        @NotEmpty(message = "Select at least one field to update")
        @Size(max = 16, message = "Too many edit fields were selected")
        Set<AdminDispatchEditField> fields,

        @Size(max = 500, message = "Item name is too long")
        String itemName,

        @Size(max = 64, message = "Packet number is too long")
        String packetNumber,

        @Size(max = 200, message = "PD number is too long")
        String pdNo,

        @Size(max = 200, message = "Drawing number is too long")
        String drawingNo,

        @Size(max = 300, message = "Client name is too long")
        String clientName,

        @Size(max = 2000, message = "Client address is too long")
        String clientAddress,

        @Size(max = 100, message = "Floor value is too long")
        String floor,

        @Size(max = 4000, message = "Description is too long")
        String description,

        @Size(max = 100, message = "Weight value is too long")
        String weight,

        @Size(max = 200, message = "Dimensions value is too long")
        String dimensions,

        @Size(max = 2000, message = "Remarks are too long")
        String remarks,

        @Size(max = 300, message = "Sticker location is too long")
        String stickerLocation,

        UUID driverId,

        @Size(max = 200, message = "Driver name is too long")
        String driverName,

        UUID vehicleId,

        @Size(max = 100, message = "Vehicle number is too long")
        String vehicleNumber,

        LocalDateTime dispatchDateTime) {
}
