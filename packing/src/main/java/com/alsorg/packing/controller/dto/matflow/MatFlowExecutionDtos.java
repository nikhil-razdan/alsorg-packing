package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowExecutionDtos {

    private MatFlowExecutionDtos() {
    }

    public record ProcessingJobCreateRequest(
            UUID reservationId,
            UUID routeStepId,
            UUID outputMaterialId,
            BigDecimal plannedInputQty,
            String remarks) {
    }

    public record ProcessingJobStartRequest(
            Long rowVersion,
            BigDecimal actualInputQty,
            String batchNo,
            String remarks) {
    }

    public record ProcessingJobCompleteRequest(
            Long rowVersion,
            BigDecimal outputQty,
            BigDecimal wastageQty,
            String batchNo,
            String remarks) {
    }

    public record ProcessingJobResponse(
            UUID id,
            String jobNumber,
            UUID requisitionId,
            String requisitionNumber,
            UUID reservationId,
            UUID routeStepId,
            String processCode,
            UUID locationId,
            String locationCode,
            String plantCode,
            UUID inputMaterialId,
            String inputMaterialCode,
            UUID outputMaterialId,
            String outputMaterialCode,
            BigDecimal plannedInputQty,
            BigDecimal actualInputQty,
            BigDecimal outputQty,
            BigDecimal wastageQty,
            ProcessingJobStatus status,
            String startedBy,
            LocalDateTime startedAt,
            String completedBy,
            LocalDateTime completedAt,
            String remarks,
            Long rowVersion) {
    }

    public record ConsumptionLineRequest(
            UUID requisitionLineId,
            BigDecimal quantity,
            String batchNo,
            String remarks) {
    }

    public record ConsumptionRequest(
            UUID requisitionId,
            UUID productionLocationId,
            String remarks,
            List<ConsumptionLineRequest> lines) {
    }

    public record ConsumptionLineResponse(
            UUID id,
            UUID requisitionLineId,
            String materialCode,
            BigDecimal consumedQty,
            String uom,
            String batchNo) {
    }

    public record ConsumptionResponse(
            UUID id,
            String consumptionNumber,
            UUID requisitionId,
            String requisitionNumber,
            UUID productionLocationId,
            String productionLocationCode,
            String plantCode,
            String consumedBy,
            LocalDateTime consumedAt,
            String remarks,
            List<ConsumptionLineResponse> lines) {
    }
}