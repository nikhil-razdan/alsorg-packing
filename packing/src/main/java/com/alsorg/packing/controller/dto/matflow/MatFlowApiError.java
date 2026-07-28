package com.alsorg.packing.controller.dto.matflow;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;

public record MatFlowApiError(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        Map<String, String> validationErrors
) {

    public MatFlowApiError {
        validationErrors = validationErrors == null
                ? Collections.emptyMap()
                : Map.copyOf(validationErrors);
    }

    public static MatFlowApiError of(
            int status,
            String error,
            String message,
            String path
    ) {
        return new MatFlowApiError(
                Instant.now(),
                status,
                error,
                message,
                path,
                Collections.emptyMap()
        );
    }

    public static MatFlowApiError validation(
            int status,
            String error,
            String message,
            String path,
            Map<String, String> validationErrors
    ) {
        return new MatFlowApiError(
                Instant.now(),
                status,
                error,
                message,
                path,
                validationErrors
        );
    }
}