package com.alsorg.packing.controller.dto.matflow;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class MatFlowInsightDtos {
    private MatFlowInsightDtos() {}

    public record DashboardResponse(
            long activeProjects,
            long totalProductionFiles,
            long green,
            long amber,
            long red,
            long needsAttention,
            long design,
            long ppcGate1,
            long engineering,
            long ppcGate2,
            long productionReleased,
            long openQueries,
            long overdueWork,
            List<ProductionRiskRow> attentionFiles,
            Map<String, Long> stageCounts,
            LocalDateTime generatedAt) {}

    public record ProductionRiskRow(
            UUID productionFileId,
            String productionFileNo,
            String projectCode,
            String projectName,
            String productName,
            String drawingNo,
            String stage,
            String health,
            String currentDepartment,
            String currentOwner,
            LocalDate plannedProductionReleaseDate,
            LocalDate plannedDispatchDate,
            int openQueries,
            int pendingTasks,
            int overdueItems,
            List<String> blockers,
            LocalDateTime updatedAt) {}

    public record EngineeringKpis(
            long filesInEngineering,
            long filesApproved,
            long openQueries,
            long pendingTasks,
            long completedTasks,
            double firstTimeRightPercent,
            double averageCompletedTaskMinutes,
            LocalDateTime generatedAt) {}
}
