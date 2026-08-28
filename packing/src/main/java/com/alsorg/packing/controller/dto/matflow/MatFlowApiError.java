package com.alsorg.packing.controller.dto.matflow;

import java.time.LocalDateTime;
import java.util.Map;

public record MatFlowApiError(
        LocalDateTime timestamp,
        int status,
        String error,
        String message,
        String path,
        Map<String, Object> details) {
}
