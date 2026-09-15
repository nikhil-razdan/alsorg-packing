package com.alsorg.packing.controller.dto.matflow;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class MatFlowInsightDtos {
    private MatFlowInsightDtos() {}

    public record DashboardResponse(
            long totalProductionFiles,
            long green,
            long amber,
            long red,
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
            String productName,
            String stage,
            String health,
            String currentOwner,
            int openQueries,
            int pendingTasks,
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
