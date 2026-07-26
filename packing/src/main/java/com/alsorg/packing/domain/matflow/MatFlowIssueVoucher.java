package com.alsorg.packing.domain.matflow;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class MatFlowIssueVoucher {
    UUID id;
String issueVoucherNo;

UUID requisitionId;

String plantCode;
String pdNo;
String drawingNo;
String projectCode;

String issuedTo;
String productionDepartment;

LocalDate issueDate;

MatFlowIssueVoucherStatus status;

String issuedBy;
LocalDateTime issuedAt;

String acknowledgedBy;
LocalDateTime acknowledgedAt;

String remarks;

Long rowVersion;
}
