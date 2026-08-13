package com.alsorg.packing.controller.dto.matflow;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowMaterialRegisterDtos {
    private MatFlowMaterialRegisterDtos() {
    }

    public record MaterialRegisterRow(
            UUID materialId,
            String materialCode,
            String materialName,
            String category,
            String specification,
            String uom,
            BigDecimal purchasedQty,
            BigDecimal issuedQty,
            BigDecimal consumedQty,
            BigDecimal productionWastedQty,
            BigDecimal processingWastedQty,
            BigDecimal returnedQty,
            BigDecimal onHandQty,
            BigDecimal availableQty,
            LocalDateTime lastMovementAt) {
    }

    public record MaterialRegisterResponse(
            LocalDateTime generatedAt,
            String plantCode,
            List<MaterialRegisterRow> rows) {
    }
}
