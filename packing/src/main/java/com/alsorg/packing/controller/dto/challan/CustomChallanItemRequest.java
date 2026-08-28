package com.alsorg.packing.controller.dto.challan;

import jakarta.validation.constraints.Size;

public record CustomChallanItemRequest(
        @Size(max = 1000, message = "Item description cannot exceed 1000 characters")
        String description,

        @Size(max = 200, message = "Drawing number cannot exceed 200 characters")
        String drawingNo,

        Double quantity,

        @Size(max = 32, message = "UOM cannot exceed 32 characters")
        String uom,

        Boolean returnable,

        @Size(max = 1000, message = "Remarks cannot exceed 1000 characters")
        String remarks) {
}
