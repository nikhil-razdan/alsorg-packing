package com.alsorg.packing.domain.matflow;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class MatFlowReceipt {
    UUID id;
    String receiptNo;
    String grnNo;

    UUID purchaseOrderId;

    String supplierChallanNo;
    String supplierInvoiceNo;
    String vehicleNo;

    LocalDate receiptDate;
    LocalDate grnDate;

    MatFlowReceiptStatus status;

    String receivedBy;
    LocalDateTime receivedAt;

    String grnBy;
    LocalDateTime grnAt;

    String remarks;

    Long rowVersion;
}
