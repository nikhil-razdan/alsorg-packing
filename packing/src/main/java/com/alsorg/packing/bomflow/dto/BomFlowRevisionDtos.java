package com.alsorg.packing.bomflow.dto;

import com.alsorg.packing.bomflow.domain.BomFlowRevisionStatus;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class BomFlowRevisionDtos {

    private BomFlowRevisionDtos() {
    }

    public record CreateRevisionRequest(
            @Size(max = 2000) String remarks) {
    }

    public record RevisionLineRequest(
            @NotBlank @Size(max = 120) String section,
            @Size(max = 100) String category,
            @NotBlank @Size(max = 500) String itemName,
            @Size(max = 255) String brand,
            @Size(max = 220) String vendorName,
            @NotBlank @Size(max = 60) String unit,
            @DecimalMin(value = "0.0001") BigDecimal requiredQty,
            @DecimalMin(value = "0.0001") BigDecimal quantity,
            @DecimalMin(value = "0.0") BigDecimal rate,
            @DecimalMin(value = "0.0") @DecimalMax(value = "100.0") BigDecimal gstPercent,
            @DecimalMin(value = "0.0") @DecimalMax(value = "100.0") BigDecimal gst,
            @Size(max = 3000) String remarks,
            @PositiveOrZero Long rowVersion) {
    }

    public record DeleteLineRequest(
            @PositiveOrZero Long rowVersion) {
    }

    public record RevisionActionRequest(
            @Size(max = 3000) String remarks,
            @PositiveOrZero Long rowVersion) {
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
