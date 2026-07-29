package com.alsorg.packing.controller.dto.matflow;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class MatFlowMetadataDtos {

    private MatFlowMetadataDtos() {
    }

    public record MetadataResponse(
            String apiVersion,
            LocalDateTime generatedAt,
            Set<String> allowedPlants,
            List<String> roles,
            Map<String, List<String>> enums) {
    }
}