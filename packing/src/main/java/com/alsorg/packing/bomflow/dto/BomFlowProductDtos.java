package com.alsorg.packing.bomflow.dto;

import com.alsorg.packing.bomflow.domain.BomFlowProductStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public final class BomFlowProductDtos {

    private BomFlowProductDtos() {
    }

    public record ProductRequest(
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
            Long rowVersion) {
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
