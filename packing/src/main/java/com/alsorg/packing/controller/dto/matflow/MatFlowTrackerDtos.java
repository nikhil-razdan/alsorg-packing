package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Plant / Store / Processing Unit / Production-user tracker contracts.
 *
 * The word Location is deliberately absent from the public contract. Internal
 * compatibility node IDs may be returned as custody IDs for trace correlation,
 * but operators work only with business custody and plant/user ownership.
 */
public final class MatFlowTrackerDtos {
    private MatFlowTrackerDtos() {
    }

    public record TrackerRowResponse(
            UUID requisitionId,
            String requisitionNumber,
            UUID projectDrawingId,
            String projectCode,
            String projectName,
            String clientName,
            String drawingNo,
            String productName,
            UUID bomId,
            String bomNumber,
            Integer bomRevisionNo,
            UUID productionCustodyId,
            String productionCustodyCode,
            String productionCustodyName,
            String productionPlantCode,
            RequisitionStatus requisitionStatus,
            String currentStage,
            String responsibleDesk,
            int progressPercent,
            int materialReadyPercent,
            boolean readyToStartProduction,
            String productionStartBlocker,
            BigDecimal requestedQty,
            BigDecimal reservedQty,
            BigDecimal shortageQty,
            BigDecimal issuedQty,
            BigDecimal consumedQty,
            BigDecimal returnedQty,
            int reservationCount,
            int indentCount,
            int openIndentCount,
            int transferCount,
            int openTransferCount,
            int readyTransferCount,
            LocalDateTime requestedAt,
            LocalDateTime submittedAt,
            LocalDateTime plannedAt,
            LocalDateTime updatedAt,
            long ageHours,
            Long rowVersion,
            String currentDepartment,
            UUID currentCustodyId,
            String currentCustodyCode,
            String currentCustodyName,
            String currentCustodyType,
            LocalDateTime stageStartedAt,
            LocalDateTime stageEndedAt,
            long stageDurationMinutes,
            long totalLeadTimeMinutes,
            long targetMinutes,
            String timingHealth,
            String nextDepartment,
            UUID nextCustodyId,
            String nextCustodyCode,
            String nextCustodyName,
            LocalDateTime completedAt,
            int actualProgressPercent,
            String bottleneckHint) {
    }

    public record TrackerKpiResponse(
            int activeRequisitions,
            int awaitingStorePlanning,
            int shortagePending,
            int materialReserved,
            int transfersInProgress,
            int productionInProgress,
            int openIndents,
            BigDecimal totalRequestedQty,
            BigDecimal totalReservedQty,
            BigDecimal totalShortageQty) {
    }

    public record TrackerResponse(TrackerKpiResponse kpis, List<TrackerRowResponse> rows) {
    }

    public record TrackerStageTiming(
            String key,
            String label,
            String department,
            UUID custodyId,
            String custodyCode,
            String custodyName,
            String custodyType,
            String state,
            LocalDateTime startedAt,
            LocalDateTime endedAt,
            long durationMinutes,
            long targetMinutes,
            long varianceMinutes,
            String timingHealth,
            String actor,
            String referenceType,
            UUID referenceId,
            String referenceNumber,
            String note) {
    }

    public record TrackerMaterialPosition(
            UUID requisitionLineId,
            UUID reservationId,
            UUID materialId,
            String bomMaterialCode,
            String currentMaterialCode,
            String materialName,
            String materialCategory,
            String uom,
            BigDecimal requestedQty,
            BigDecimal reservedQty,
            BigDecimal shortageQty,
            BigDecimal issuedQty,
            BigDecimal consumedQty,
            BigDecimal returnedQty,
            BigDecimal trackedQty,
            String currentDepartment,
            UUID currentCustodyId,
            String currentCustodyCode,
            String currentCustodyName,
            String currentCustodyType,
            String movementState,
            LocalDateTime lastMovedAt,
            String nextDepartment,
            UUID nextCustodyId,
            String nextCustodyCode,
            String activeReferenceType,
            UUID activeReferenceId,
            String activeReferenceNumber) {
    }

    public record TrackerAuditEvent(
            UUID id,
            String entityType,
            UUID entityId,
            String action,
            String actor,
            LocalDateTime actionAt,
            String plantCode,
            String projectCode,
            String drawingNo,
            String detailsJson) {
    }

    public record TrackerCycleSummary(
            LocalDateTime projectStartedAt,
            LocalDateTime requisitionStartedAt,
            LocalDateTime completedAt,
            long totalProjectMinutes,
            long requisitionLeadMinutes,
            long currentStageMinutes,
            int completedStageCount,
            int applicableStageCount,
            long averageCompletedStageMinutes,
            String bottleneckStage,
            long bottleneckMinutes,
            int breachedStageCount,
            boolean completed) {
    }

    public record TrackerDetailResponse(
            TrackerRowResponse summary,
            TrackerCycleSummary cycle,
            List<TrackerStageTiming> stages,
            List<TrackerStageTiming> operations,
            List<TrackerMaterialPosition> materials,
            List<TrackerAuditEvent> auditEvents,
            LocalDateTime generatedAt) {
    }
}
