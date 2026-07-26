package com.alsorg.packing.controller.dto.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowMaterialCategory;
import com.alsorg.packing.domain.bomflow.BomFlowStatus;
import com.alsorg.packing.domain.bomflow.MaterialUnit;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class BomFlowDtos {

    private BomFlowDtos() {
    }

    public record UpdateBomRequest(
            String pdNo,
            String drawingNo,
            String projectCode,
            String clientName,
            String productName,
            String productCode,
            String productDescription,
            String remarks,
            Long bomRowVersion,
            Long revisionRowVersion) {
    }

    public record CreateRevisionRequest(
            String revisionReason,
            Long bomRowVersion) {
    }

    public record SubmitBomRequest(
            String engineeringRemarks,
            UUID bomDocumentAttachmentId,
            UUID drawingAttachmentId,
            UUID sampleAttachmentId,
            Long revisionRowVersion) {
    }

    public record ApproveBomRequest(
            String remarks,
            Long revisionRowVersion) {
    }

    public record ReturnBomRequest(
            String remarks,
            Long revisionRowVersion) {
    }

    public record DeactivateBomItemRequest(
            String reason,
            Long rowVersion) {
    }

    public record BomListResponse(
            UUID id,
            String bomNo,
            String plantCode,
            String pdNo,
            String drawingNo,
            String projectCode,
            String clientName,
            String productName,
            String productCode,
            String productDescription,
            Integer currentRevisionNo,
            BomFlowStatus status,
            String remarks,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }

    public record BomItemResponse(
            UUID id,
            UUID revisionId,
            Integer lineNo,

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
            boolean active,

            String remarks,

            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,

            Long rowVersion) {
    }

    public record BomRevisionResponse(
            UUID id,
            UUID bomId,
            Integer revisionNo,
            BomFlowStatus status,

            String revisionReason,
            String engineeringRemarks,

            UUID bomDocumentAttachmentId,
            UUID drawingAttachmentId,
            UUID sampleAttachmentId,

            String preparedBy,
            LocalDateTime preparedAt,

            String submittedBy,
            LocalDateTime submittedAt,

            String approvedBy,
            LocalDateTime approvedAt,

            String returnedBy,
            LocalDateTime returnedAt,
            String returnRemarks,

            String releasedBy,
            LocalDateTime releasedAt,

            long activeItemCount,
            BigDecimal materialTotal,
            BigDecimal processingTotal,
            BigDecimal grandTotal,

            Long rowVersion) {
    }

    public record BomDetailResponse(
            BomListResponse bom,
            List<BomRevisionResponse> revisions,
            BomRevisionResponse currentRevision,
            List<BomItemResponse> currentItems) {
    }

    public record RevisionDetailResponse(
            BomListResponse bom,
            BomRevisionResponse revision,
            List<BomItemResponse> items) {
    }

    public record BomAuditResponse(
            UUID id,
            UUID bomId,
            UUID revisionId,
            UUID itemId,
            String action,
            String oldValue,
            String newValue,
            String changedBy,
            LocalDateTime changedAt) {
    }
}