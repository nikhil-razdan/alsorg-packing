package com.alsorg.packing.domain.matflow;

import java.math.BigDecimal;
import java.util.UUID;

import com.alsorg.packing.domain.bomflow.MaterialUnit;

public class MatFlowIssueVoucherLine {
    UUID id;
    UUID issueVoucherId;
    UUID requisitionLineId;
    UUID matFlowLineId;
    UUID stockBlockId;
    UUID receiptLineId;

    MatFlowIssueSource source;

    BigDecimal issuedQty;
    MaterialUnit unit;

    Long rowVersion;
}
