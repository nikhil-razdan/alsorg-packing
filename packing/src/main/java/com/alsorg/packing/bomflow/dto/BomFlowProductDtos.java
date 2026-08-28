package com.alsorg.packing.bomflow.dto;

import com.alsorg.packing.bomflow.domain.BomFlowProductStatus;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public final class BomFlowProductDtos {

    private BomFlowProductDtos() {
    }

    public record ProductRequest(
            @NotBlank @Size(max = 500) String productName,
            @NotBlank @Size(max = 150) String productCode,
            @Size(max = 160) String drawingNumber,
            @NotBlank @Size(max = 120) String category,
            @Size(max = 160) String collection,
            @DecimalMin(value = "0.001") BigDecimal length,
            @DecimalMin(value = "0.001") BigDecimal width,
            @DecimalMin(value = "0.001") BigDecimal height,
            @Size(max = 180) String projectReference,
            @Size(max = 240) String clientEntity,
            @PositiveOrZero Long rowVersion) {
    }

    public record ProductResponse(
            UUID id,
            String productName,
            String productCode,
            String drawingNumber,
            String category,
            String collection,
            BigDecimal length,
            BigDecimal width,
            BigDecimal height,
            String projectReference,
            String clientEntity,
            BomFlowProductStatus status,
            Integer currentRevisionNo,
            long revisionCount,
            UUID latestRevisionId,
            Integer latestRevisionNo,
            String latestRevisionStatus,
            boolean hasProductImage,
            String productImageFileName,
            String productImageContentType,
            Long productImageSize,
            String productImageUploadedBy,
            LocalDateTime productImageUploadedAt,
            boolean hasDrawingFile,
            String drawingFileName,
            String drawingFileContentType,
            Long drawingFileSize,
            String drawingFileUploadedBy,
            LocalDateTime drawingFileUploadedAt,
            String createdBy,
            LocalDateTime createdAt,
            String updatedBy,
            LocalDateTime updatedAt,
            Long rowVersion) {
    }
}
