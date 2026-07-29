package com.alsorg.packing.controller.dto.matflow;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class MatFlowIntegrityDtos {

    private MatFlowIntegrityDtos() {
    }

    public enum IntegritySeverity {

        CRITICAL,

        WARNING
    }

    public record IntegrityViolation(
            IntegritySeverity severity,
            String checkCode,
            String entityType,
            UUID entityId,
            String reference,
            String plantCode,
            String message) {
    }

    public record IntegritySummary(
            long checkedRecords,
            long criticalViolations,
            long warningViolations,
            boolean healthy) {
    }

    public record IntegrityReport(
            LocalDateTime generatedAt,
            Set<String> plantCodes,
            IntegritySummary summary,
            List<IntegrityViolation> violations) {
    }
}