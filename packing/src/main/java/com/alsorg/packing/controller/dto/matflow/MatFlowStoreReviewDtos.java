package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowStockBlockStatus;
import com.alsorg.packing.domain.matflow.MatFlowStockSourceType;
import com.alsorg.packing.domain.matflow.MatFlowStoreDecision;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowStoreReviewDtos {

    private MatFlowStoreReviewDtos() {
    }

    public record StoreReviewLineRequest(
            UUID requisitionLineId,
            MatFlowStoreDecision decision,
            MatFlowStockSourceType sourceType,

            /*
             * Used only for OFFLINE_MANUAL.
             *
             * SYSTEM_INVENTORY obtains quantity through the
             * inventory gateway.
             */
            BigDecimal verifiedAvailableQty,

            String sourceReference,
            String remarks,

            Long requisitionLineRowVersion,
            Long matFlowLineRowVersion,

            /*
             * Required only when Store is updating an existing
             * active stock-block record.
             */
            Long stockBlockRowVersion
    ) {
    }

    public record StoreReviewRequest(
            Long requisitionRowVersion,
            String remarks,
            List<StoreReviewLineRequest> lines
    ) {
    }

    public record ReturnToProductionRequest(
            Long requisitionRowVersion,
            String remarks
    ) {
    }

    public record StoreReviewLineResponse(
            UUID requisitionLineId,
            UUID matFlowLineId,
            Integer sourceLineNo,
            String itemCode,
            String itemName,

            BigDecimal requestedQty,

            MatFlowStoreDecision decision,
            MatFlowStockSourceType sourceType,
            String sourceReference,

            BigDecimal availableQtySnapshot,
            BigDecimal blockedQty,
            BigDecimal shortageQty,

            MatFlowLineStatus lineStatus,
            MatFlowStockBlockStatus stockBlockStatus,

            String reviewedBy,
            LocalDateTime reviewedAt,
            String remarks,

            Long requisitionLineRowVersion,
            Long matFlowLineRowVersion,
            Long stockBlockRowVersion
    ) {
    }

    public record StoreReviewResponse(
            UUID requisitionId,
            String requisitionNo,
            UUID releaseId,

            String plantCode,
            String pdNo,
            String drawingNo,
            String projectCode,
            String clientName,
            String productName,

            LocalDate requiredByDate,
            String productionDepartment,
            String requestedFor,

            MatFlowRequisitionStatus requisitionStatus,

            BigDecimal totalRequestedQty,
            BigDecimal totalBlockedQty,
            BigDecimal totalShortageQty,

            String remarks,
            Long requisitionRowVersion,

            List<StoreReviewLineResponse> lines
    ) {
    }

    public record StoreQueueResponse(
            UUID requisitionId,
            String requisitionNo,
            UUID releaseId,

            String plantCode,
            String pdNo,
            String clientName,
            String productName,

            LocalDate requiredByDate,
            String productionDepartment,
            String requestedFor,

            MatFlowRequisitionStatus status,
            int lineCount,

            BigDecimal totalRequestedQty,
            BigDecimal totalBlockedQty,
            BigDecimal totalShortageQty,

            String submittedBy,
            LocalDateTime submittedAt,

            Long rowVersion
    ) {
    }
}