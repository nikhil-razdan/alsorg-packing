package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowTrackerDtos {

    private MatFlowTrackerDtos() {
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

    public record TrackerRowResponse(
            UUID requisitionId,
            String requisitionNumber,

            UUID projectDrawingId,
            String projectCode,
            String drawingNo,

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
            Long rowVersion) {
    }

    public record TrackerResponse(
            TrackerKpiResponse kpis,
            List<TrackerRowResponse> rows) {
    }
}