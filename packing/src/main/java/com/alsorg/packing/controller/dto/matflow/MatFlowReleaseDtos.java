package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.bomflow.BomFlowMaterialCategory;
import com.alsorg.packing.domain.bomflow.MaterialUnit;
import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowReleaseStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowReleaseDtos {

    private MatFlowReleaseDtos() {
    }

    public record ReleaseToMatFlowRequest(
            Long bomRowVersion,
            Long revisionRowVersion,
            String remarks) {
    }

    public record MatFlowReleaseResponse(
            UUID id,

            UUID sourceBomId,
            UUID sourceRevisionId,
            Integer sourceRevisionNo,

            String bomNo,
            String plantCode,
            String pdNo,
            String drawingNo,
            String projectCode,

            String clientName,
            String productName,
            String productCode,
            String productDescription,

            MatFlowReleaseStatus status,

            Integer releasedLineCount,
            Integer skippedLineCount,

            UUID previousReleaseId,
            UUID supersededByReleaseId,

            String releaseRemarks,

            String releasedBy,
            LocalDateTime releasedAt,

            String updatedBy,
            LocalDateTime updatedAt,

            Long rowVersion) {
    }

    public record MatFlowLineResponse(
            UUID id,
            UUID releaseId,

            UUID sourceBomItemId,
            Integer sourceLineNo,

            BomFlowMaterialCategory category,
            String subCategory,

            UUID inventoryItemId,
            String itemCode,
            String itemName,
            String itemDescription,

            String specification,
            String grade,
            String brand,
            String finish,
            String colour,

            String thickness,
            String size,

            BigDecimal length,
            BigDecimal width,
            BigDecimal height,

            BigDecimal baseQty,
            BigDecimal wastagePercent,
            BigDecimal requiredQty,

            MaterialUnit unit,

            BigDecimal unitRate,
            BigDecimal materialAmount,
            BigDecimal processingAmount,
            BigDecimal totalAmount,

            boolean storeIssueRequired,

            BigDecimal requisitionedQty,
            BigDecimal blockedQty,
            BigDecimal shortageQty,
            BigDecimal indentedQty,
            BigDecimal orderedQty,
            BigDecimal receivedQty,
            BigDecimal acceptedQty,
            BigDecimal rejectedQty,
            BigDecimal holdQty,
            BigDecimal issuedQty,

            MatFlowLineStatus status,
            boolean active,

            Long rowVersion) {
    }

    public record MatFlowReleaseDetailResponse(
            MatFlowReleaseResponse release,
            List<MatFlowLineResponse> lines) {
    }

    public record MatFlowAuditResponse(
            UUID id,
            UUID releaseId,
            String entityType,
            UUID entityId,
            String action,
            String oldValue,
            String newValue,
            String changedBy,
            LocalDateTime changedAt) {
    }
}