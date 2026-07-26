package com.alsorg.packing.domain.matflow;

import java.math.BigDecimal;
import java.util.UUID;

import com.alsorg.packing.domain.bomflow.MaterialUnit;

public class MatFlowMaterialIndentLine {
    UUID id;
    UUID indentId;
    UUID requisitionLineId;
    UUID matFlowLineId;

    BigDecimal shortageQty;
    BigDecimal approvedQty;
    BigDecimal orderedQty;

    MaterialUnit unit;

    String technicalRemarks;

    Long rowVersion;
}
