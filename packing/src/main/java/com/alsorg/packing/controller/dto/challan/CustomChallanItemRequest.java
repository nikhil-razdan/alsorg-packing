package com.alsorg.packing.controller.dto.challan;

public record CustomChallanItemRequest(
        String description,
        String drawingNo,
        Double quantity,
        String uom,
        Boolean returnable,
        String remarks
) {
}