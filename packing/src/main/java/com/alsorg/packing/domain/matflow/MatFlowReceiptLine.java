package com.alsorg.packing.domain.matflow;

import java.math.BigDecimal;
import java.util.UUID;

import com.alsorg.packing.domain.bomflow.MaterialUnit;

public class MatFlowReceiptLine {
    UUID id;
    UUID receiptId;
    UUID purchaseOrderLineId;
    UUID matFlowLineId;

    BigDecimal receivedQty;
    BigDecimal inspectedQty;
    BigDecimal acceptedQty;
    BigDecimal rejectedQty;
    BigDecimal holdQty;

    MaterialUnit unit;

    String supplierBatchNo;
    String storageLocation;

    Long rowVersion;
}
