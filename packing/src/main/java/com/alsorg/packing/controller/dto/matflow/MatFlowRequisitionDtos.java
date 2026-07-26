package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.bomflow.MaterialUnit;
import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowRequisitionDtos {

    private MatFlowRequisitionDtos() {
    }

    /*
     * =========================================================
     * CREATE DRAFT
     * =========================================================
     */

    public record CreateRequisitionRequest(
            UUID releaseId,
            LocalDate requiredByDate,
            String productionDepartment,
            String requestedFor,
            String remarks,
            Long releaseRowVersion) {
    }

    /*
     * =========================================================
     * ADD OR UPDATE MATERIAL LINE
     * =========================================================
     */

    public record SaveRequisitionLineRequest(
            UUID matFlowLineId,
            BigDecimal requestedQty,
            String productionRemarks,
            Long requisitionRowVersion,
            Long matFlowLineRowVersion) {
    }

    /*
     * Used when submitting or cancelling the requisition.
     */
    public record RequisitionActionRequest(
            Long requisitionRowVersion,
            String remarks) {
    }

    /*
     * =========================================================
     * RESPONSES
     * =========================================================
     */

    public record RequisitionLineResponse(
            UUID id,
            UUID matFlowLineId,
            UUID sourceBomItemId,
            Integer sourceLineNo,
            String itemCode,
            String itemName,
            String itemDescription,
            String specification,

            BigDecimal requestedQty,
            BigDecimal blockedQty,
            BigDecimal shortageQty,
            BigDecimal issuedQty,

            MaterialUnit unit,
            MatFlowLineStatus status,
            String productionRemarks,

            Long rowVersion) {
    }

    public record RequisitionDetailResponse(
            UUID id,
            String requisitionNo,
            UUID releaseId,

            String plantCode,
            String pdNo,
            String drawingNo,
            String projectCode,
            String clientName,
            String productName,
            String productCode,

            LocalDate requiredByDate,
            String productionDepartment,
            String requestedFor,

            MatFlowRequisitionStatus status,

            String createdBy,
            LocalDateTime createdAt,

            String submittedBy,
            LocalDateTime submittedAt,

            String remarks,
            Long rowVersion,

            List<RequisitionLineResponse> lines) {
    }

    public record RequisitionListResponse(
            UUID id,
            String requisitionNo,
            UUID releaseId,

            String plantCode,
            String pdNo,
            String drawingNo,
            String clientName,
            String productName,

            LocalDate requiredByDate,
            String productionDepartment,
            String requestedFor,

            MatFlowRequisitionStatus status,

            int lineCount,
            BigDecimal totalRequestedQty,

            String createdBy,
            LocalDateTime createdAt,
            String submittedBy,
            LocalDateTime submittedAt,

            Long rowVersion) {
    }

    public record UpdateRequisitionRequest(
            LocalDate requiredByDate,
            String productionDepartment,
            String requestedFor,
            String remarks,
            Long requisitionRowVersion) {
    }
}