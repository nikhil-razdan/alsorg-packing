package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.bomflow.MaterialUnit;
import com.alsorg.packing.domain.matflow.MatFlowIndentLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowIndentStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowIndentDtos {

    private MatFlowIndentDtos() {
    }

    public record CreateIndentRequest(
            UUID requisitionId,
            String remarks,
            Long requisitionRowVersion) {
    }

    public record SaveIndentLineRequest(
            UUID requisitionLineId,
            BigDecimal indentQty,
            String remarks,

            Long indentRowVersion,
            Long requisitionLineRowVersion,
            Long matFlowLineRowVersion) {
    }

    public record IndentActionRequest(
            Long indentRowVersion,
            String remarks) {
    }

    public record IndentLineResponse(
            UUID id,
            UUID requisitionLineId,
            UUID matFlowLineId,
            UUID sourceBomItemId,
            Integer sourceLineNo,

            String itemCode,
            String itemName,
            String itemDescription,
            String specification,

            BigDecimal shortageQtySnapshot,
            BigDecimal indentQty,
            BigDecimal orderedQty,
            BigDecimal receivedQty,

            MaterialUnit unit,
            MatFlowIndentLineStatus status,
            String remarks,

            Long rowVersion) {
    }

    public record IndentDetailResponse(
            UUID id,
            String indentNo,

            UUID requisitionId,
            UUID releaseId,
            String requisitionNo,

            String plantCode,
            String pdNo,
            String drawingNo,
            String projectCode,
            String clientName,
            String productName,
            String productionDepartment,

            LocalDate requiredByDate,

            MatFlowIndentStatus status,

            String createdBy,
            LocalDateTime createdAt,

            String submittedBy,
            LocalDateTime submittedAt,

            String remarks,
            Long rowVersion,

            List<IndentLineResponse> lines) {
    }
}