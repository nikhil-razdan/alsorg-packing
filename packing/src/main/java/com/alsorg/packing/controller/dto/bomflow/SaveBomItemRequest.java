package com.alsorg.packing.controller.dto.bomflow;

import java.math.BigDecimal;
import java.util.UUID;

import com.alsorg.packing.domain.bomflow.BomFlowMaterialCategory;
import com.alsorg.packing.domain.bomflow.MaterialUnit;

public record SaveBomItemRequest(
        Integer lineNo,
        BomFlowMaterialCategory category,
        String subCategory,
        UUID inventoryItemId,
        String itemCode,
        String itemName,
        String itemDescription,
        String specification,
        String grade,
        String brand,
        String finish,
        String colour,
        String thickness,
        String size,
        BigDecimal length,
        BigDecimal width,
        BigDecimal height,
        BigDecimal baseQty,
        BigDecimal wastagePercent,
        MaterialUnit unit,
        BigDecimal unitRate,
        BigDecimal processingAmount,
        Boolean storeIssueRequired,
        String remarks,
        Long rowVersion) {
}
