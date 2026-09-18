package com.alsorg.packing.controller.dto.matflow;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Engineering BOM DTOs. BOMs are Product-specific inside one Project Production File. */
public final class MatFlowBomDtos {
    private MatFlowBomDtos() {}

    public record BomCreateRequest(
            UUID productionFileId,
            UUID productId,
            String remarks) {}

    public record BomUpdateRequest(
            String remarks,
            Long rowVersion) {}

    public record BomLineRequest(
            UUID materialId,
            String materialCode,
            String materialName,
            String category,
            String specification,
            String uom,
            BigDecimal requiredQty,
            BigDecimal wastagePercent,
            String remarks,
            Long rowVersion) {}

    public record BomActionRequest(Long rowVersion, String remarks) {}

    public record BomLineResponse(
            UUID id,
            Integer lineNo,
            UUID materialId,
            String materialCode,
            String materialName,
            String category,
            String specification,
            String uom,
            BigDecimal requiredQty,
            BigDecimal wastagePercent,
            BigDecimal netRequiredQty,
            String remarks,
            Long rowVersion) {}

    public record BomResponse(
            UUID id,
            String bomNumber,
            UUID productionFileId,
            String productionFileNo,
            String projectCode,
            String projectName,
            UUID productId,
            String productName,
            String drawingNo,
            String createdBy,
            Integer revisionNo,
            String status,
            boolean latestRevision,
            String remarks,
            String submittedBy,
            LocalDateTime submittedAt,
            String releasedBy,
            LocalDateTime releasedAt,
            Long rowVersion,
            LocalDateTime updatedAt,
            boolean legacy,
            boolean editable,
            boolean canCreateRevision,
            List<BomLineResponse> lines) {}
}
