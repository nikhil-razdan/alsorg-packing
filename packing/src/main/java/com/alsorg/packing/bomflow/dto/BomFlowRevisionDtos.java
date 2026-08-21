package com.alsorg.packing.bomflow.dto;

import com.alsorg.packing.bomflow.domain.BomFlowRevisionStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class BomFlowRevisionDtos {

    private BomFlowRevisionDtos() {
    }

    public record CreateRevisionRequest(
            String remarks) {
    }

    public record RevisionLineRequest(
            String section,
            String category,
            String itemName,
            String brand,
            String vendorName,
            String unit,
            BigDecimal requiredQty,
            BigDecimal quantity,
            BigDecimal rate,
            BigDecimal gstPercent,
            BigDecimal gst,
            String remarks,
            Long rowVersion) {
    }

    public record DeleteLineRequest(
            Long rowVersion) {
    }

    public record RevisionActionRequest(
            String remarks,
            Long rowVersion) {
    }

    public record RevisionItemResponse(
            UUID id,
            Integer lineNo,
            String section,
            String category,
            String itemName,
            String item,
            String brand,
            String vendorName,
            String unit,
            BigDecimal requiredQty,
            BigDecimal quantity,
            BigDecimal rate,
            BigDecimal amount,
            BigDecimal gstPercent,
            BigDecimal gst,
            String remarks,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }

    public record RevisionSummaryResponse(
            UUID id,
            UUID productId,
            Integer revisionNo,
            Integer revisionNumber,
            BomFlowRevisionStatus status,
            String remarks,
            int itemCount,
            BigDecimal totalAmount,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }

    public record RevisionDetailResponse(
            UUID id,
            UUID productId,
            String productName,
            String productCode,
            String drawingNumber,
            String category,
            String collection,
            BigDecimal length,
            BigDecimal width,
            BigDecimal height,
            String projectReference,
            String projectCode,
            String clientEntity,
            Integer revisionNo,
            Integer revisionNumber,
            BomFlowRevisionStatus status,
            String remarks,
            String submittedBy,
            LocalDateTime submittedAt,
            String verifiedBy,
            LocalDateTime verifiedAt,
            String approvedBy,
            LocalDateTime approvedAt,
            String returnedBy,
            LocalDateTime returnedAt,
            String returnRemarks,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion,
            List<RevisionItemResponse> items,
            List<RevisionItemResponse> lines) {
    }
}
