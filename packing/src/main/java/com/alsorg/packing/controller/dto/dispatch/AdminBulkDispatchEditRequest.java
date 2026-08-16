package com.alsorg.packing.controller.dto.dispatch;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;

public record AdminBulkDispatchEditRequest(
        @NotEmpty(message = "Select at least one dispatch item")
        List<String> itemIds,

        @NotEmpty(message = "Select at least one field to update")
        Set<AdminDispatchEditField> fields,

        String itemName,

        /*
         * Admin-editable packet number.
         *
         * Accepted examples:
         * 1
         * 12
         * Pkt-12
         *
         * The service normalizes this to Pkt-N.
         */
        String packetNumber,

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

        /*
         * Business-local date/time in Asia/Kolkata.
         * Frontend datetime-local example:
         * 2026-08-16T14:30
         */
        LocalDateTime dispatchDateTime
) {
}
