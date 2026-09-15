package com.alsorg.packing.controller.dto.matflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.UUID;

public final class MatFlowMasterDtos {
    private MatFlowMasterDtos() {}

    public record MaterialRequest(
            @NotBlank @Size(max = 100) String materialCode,
            @NotBlank @Size(max = 250) String materialName,
            @NotBlank @Size(max = 120) String category,
            @Size(max = 4000) String specification,
            @NotBlank @Size(max = 40) String uom,
            Boolean active,
            Long rowVersion) {}

    public record MaterialResponse(
            UUID id,
            String materialCode,
            String materialName,
            String category,
            String specification,
            String uom,
            boolean active,
            Long rowVersion,
            LocalDateTime updatedAt) {}
}
