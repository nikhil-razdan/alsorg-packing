package com.alsorg.packing.domain.matflow;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.alsorg.packing.domain.bomflow.MaterialUnit;

public class MatFlowMovement {
    UUID id;
    UUID releaseId;
    UUID matFlowLineId;

    String movementType;
    BigDecimal quantity;
    MaterialUnit unit;

    String referenceType;
    UUID referenceId;
    String referenceNo;

    String description;
    String remarks;

    String performedBy;
    LocalDateTime performedAt;
}
