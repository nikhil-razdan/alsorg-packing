package com.alsorg.packing.controller.dto.matflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** DTOs for the canonical PD / Project -> Products model. */
public final class MatFlowProjectDtos {
    private MatFlowProjectDtos() {}

    public record ProjectRequest(
            @Size(max = 100) String projectCode,
            @NotBlank @Size(max = 250) String projectName,
            @NotBlank @Size(max = 250) String clientName,
            @NotBlank @Size(max = 50) String plantCode,
            LocalDate requiredDate,
            @Size(max = 30) String priority,
            @Size(max = 150) String projectManager,
            @Size(max = 150) String designer1,
            @Size(max = 150) String designHead,
            @Size(max = 4000) String remarks,
            Boolean active,
            Long rowVersion) {}

    public record ProductRequest(
            @NotBlank @Size(max = 250) String productName,
            @Size(max = 120) String productType,
            @Size(max = 150) String drawingNo,
            @Size(max = 40) String drawingRevision,
            @Positive Integer unitQuantity,
            BigDecimal dimensionLength,
            BigDecimal dimensionBreadth,
            BigDecimal dimensionHeight,
            LocalDate requiredDate,
            @Size(max = 4000) String remarks,
            Boolean active,
            Long rowVersion) {}

    public record ProductBulkCreateRequest(
            @NotEmpty List<@Valid ProductRequest> products) {}

    public record ProductResponse(
            UUID id,
            UUID projectId,
            String productName,
            String productType,
            String drawingNo,
            String drawingRevision,
            Integer unitQuantity,
            BigDecimal dimensionLength,
            BigDecimal dimensionBreadth,
            BigDecimal dimensionHeight,
            String dimensionUom,
            String dimensions,
            LocalDate requiredDate,
            String remarks,
            boolean active,
            boolean productImageAvailable,
            /* Shared parent Project Production File; same id for every child Product. */
            UUID productionFileId,
            String productionFileNo,
            String stage,
            String releaseHealth,
            Long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {}

    public record ProjectResponse(
            UUID id,
            String projectCode,
            String projectName,
            String clientName,
            String plantCode,
            LocalDate requiredDate,
            String priority,
            String projectManager,
            String designer1,
            String designHead,
            String remarks,
            boolean active,
            /* Canonical Production File for the whole PD / Project. */
            UUID productionFileId,
            String productionFileNo,
            String stage,
            String releaseHealth,
            int productCount,
            Long rowVersion,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<ProductResponse> products) {}
}
