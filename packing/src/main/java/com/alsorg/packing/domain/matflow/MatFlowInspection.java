package com.alsorg.packing.domain.matflow;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class MatFlowInspection {
    UUID id;
    UUID receiptLineId;
    UUID matFlowLineId;

    MatFlowInspectionDecision decision;

    BigDecimal inspectedQty;
    BigDecimal acceptedQty;
    BigDecimal rejectedQty;
    BigDecimal holdQty;

    Boolean quantityOk;
    Boolean specificationOk;
    Boolean dimensionsOk;
    Boolean thicknessOk;
    Boolean finishOk;
    Boolean colourOk;
    Boolean sampleCompared;

    String rejectionReason;
    String remarks;

    String checkedBy;
    LocalDateTime checkedAt;

    Long rowVersion;
}
