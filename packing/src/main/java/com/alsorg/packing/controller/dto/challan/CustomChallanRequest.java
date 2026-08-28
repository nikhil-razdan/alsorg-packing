package com.alsorg.packing.controller.dto.challan;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public record CustomChallanRequest(
        @Size(max = 64, message = "Challan type is too long")
        String challanType,

        @Size(max = 300, message = "From location is too long")
        String fromLocation,

        @Size(max = 300, message = "To location is too long")
        String toLocation,

        @Size(max = 200, message = "PD number is too long")
        String pdNo,

        @Size(max = 300, message = "Client name is too long")
        String clientName,

        @Size(max = 2000, message = "Client address is too long")
        String clientAddress,

        @Size(max = 1000, message = "Purpose is too long")
        String purpose,

        @Size(max = 100, message = "Movement mode is too long")
        String movementMode,

        @Size(max = 200, message = "Driver name is too long")
        String driverName,

        @Size(max = 100, message = "Vehicle number is too long")
        String vehicleNumber,

        @Size(max = 300, message = "Handed-over-to value is too long")
        String handedOverTo,

        LocalDateTime dispatchTime,

        @Valid
        @NotEmpty(message = "At least one challan item is required")
        @Size(max = 500, message = "A maximum of 500 custom challan items is allowed")
        List<CustomChallanItemRequest> items) {
}
