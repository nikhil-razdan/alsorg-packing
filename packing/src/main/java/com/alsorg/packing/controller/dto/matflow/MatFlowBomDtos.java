package com.alsorg.packing.controller.dto.matflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowBomDtos {
    private MatFlowBomDtos() {}

    public record BomCreateRequest(
            @NotNull UUID productionFileId,
            @Size(max = 4000) String remarks) {}

    public record BomUpdateRequest(
            @Size(max = 4000) String remarks,
            Long rowVersion) {}

    public record BomLineRequest(
            UUID materialId,
            @NotBlank @Size(max = 100) String materialCode,
            @NotBlank @Size(max = 250) String materialName,
            @NotBlank @Size(max = 120) String category,
            @Size(max = 4000) String specification,
            @NotBlank @Size(max = 40) String uom,
            @NotNull @DecimalMin("0.001") BigDecimal requiredQty,
            @DecimalMin("0") @DecimalMax("100") BigDecimal wastagePercent,
            @Size(max = 2000) String remarks,
            Long rowVersion) {}

    public record BomLineResponse(
            UUID id,
            int lineNo,
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
            String productName,
            String drawingNo,
            int revisionNo,
            String status,
            boolean latestRevision,
            String remarks,
            String submittedBy,
            LocalDateTime submittedAt,
            String releasedBy,
            LocalDateTime releasedAt,
            Long rowVersion,
            LocalDateTime updatedAt,
            List<BomLineResponse> lines) {}

    public record BomActionRequest(
            @Size(max = 4000) String remarks,
            Long rowVersion) {}
}
