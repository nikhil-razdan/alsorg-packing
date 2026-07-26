package com.alsorg.packing.domain.matflow;

import java.time.LocalDateTime;
import java.util.UUID;

public class MatFlowMaterialIndent {
    UUID id;
    String indentNo;

    UUID requisitionId;

    String plantCode;
    String pdNo;
    String drawingNo;
    String projectCode;

    MatFlowIndentStatus status;

    String raisedBy;
    LocalDateTime raisedAt;

    String submittedBy;
    LocalDateTime submittedAt;

    String approvedBy;
    LocalDateTime approvedAt;

    String returnedBy;
    LocalDateTime returnedAt;
    String returnRemarks;

    String remarks;

    Long rowVersion;
}
