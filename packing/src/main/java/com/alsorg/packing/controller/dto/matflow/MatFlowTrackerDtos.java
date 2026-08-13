package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Read-only professional MatFlow tracker contracts. */
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
                        UUID destinationLocationId,
                        String destinationLocationCode,
                        String destinationLocationName,
                        String destinationPlantCode,
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
                        UUID currentLocationId,
                        String currentLocationCode,
                        String currentLocationName,
                        String currentLocationType,
                        LocalDateTime stageStartedAt,
                        LocalDateTime stageEndedAt,
                        long stageDurationMinutes,
                        long totalLeadTimeMinutes,
                        long targetMinutes,
                        String timingHealth,
                        String nextDepartment,
                        UUID nextLocationId,
                        String nextLocationCode,
                        String nextLocationName,
                        LocalDateTime completedAt,
                        int actualProgressPercent,
                        String bottleneckHint) {
        }

        /**
         * 'materialInTransit' is an internal custody count, not a Transfers desk KPI.
         */
        public record TrackerKpiResponse(
                        int activeRequisitions,
                        int awaitingStorePlanning,
                        int shortagePending,
                        int materialReserved,
                        int materialInTransit,
                        int productionInProgress,
                        int openIndents,
                        BigDecimal totalRequestedQty,
                        BigDecimal totalReservedQty,
                        BigDecimal totalShortageQty) {
        }

        public record TrackerResponse(
                        TrackerKpiResponse kpis,
                        List<TrackerRowResponse> rows) {
        }

        public record TrackerStageTiming(
                        String key,
                        String label,
                        String department,
                        UUID locationId,
                        String locationCode,
                        String locationName,
                        String locationType,
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
                        UUID currentLocationId,
                        String currentLocationCode,
                        String currentLocationName,
                        String locationType,
                        String movementState,
                        LocalDateTime lastMovedAt,
                        String nextDepartment,
                        UUID nextLocationId,
                        String nextLocationCode,
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
                        long totalProjectLeadTimeMinutes,
                        long requisitionLeadTimeMinutes,
                        long currentStageMinutes,
                        int completedStageCount,
                        int applicableStageCount,
                        long averageCompletedStageMinutes,
                        String bottleneckStage,
                        long bottleneckMinutes,
                        int slaBreachedStageCount,
                        boolean completed) {
        }

        public record TrackerDetailResponse(
                        TrackerRowResponse summary,
                        TrackerCycleSummary cycle,
                        List<TrackerStageTiming> stages,
                        List<TrackerStageTiming> operations,
                        List<TrackerMaterialPosition> materials,
                        List<TrackerAuditEvent> events,
                        LocalDateTime generatedAt) {
        }
}
