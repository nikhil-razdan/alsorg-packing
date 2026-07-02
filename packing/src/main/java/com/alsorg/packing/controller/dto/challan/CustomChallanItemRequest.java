package com.alsorg.packing.controller.dto.challan;

public record CustomChallanItemRequest(
        String description,
        String drawingNo,
        Integer quantity,
        Boolean returnable,
        String remarks
) {
}