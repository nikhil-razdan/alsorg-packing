package com.alsorg.packing.controller.dto.bomflow;

public record CreateBomRequest(
        String plantCode,
        String pdNo,
        String drawingNo,
        String projectCode,
        String clientName,
        String productName,
        String productCode,
        String productDescription,
        String remarks) {
}
