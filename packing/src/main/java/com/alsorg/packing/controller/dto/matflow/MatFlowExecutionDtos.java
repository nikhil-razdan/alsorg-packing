package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Processing and Production contracts.
 * Production plant/custody is always derived from the linked MR.
 */
public final class MatFlowExecutionDtos {
        private MatFlowExecutionDtos() {
        }

        /** Legacy internal compatibility; normal UI does not manually create jobs. */
        public record ProcessingJobCreateRequest(
                        UUID reservationId,
                        UUID routeStepId,
                        UUID outputMaterialId,
                        BigDecimal plannedInputQty,
                        String remarks) {
        }

        public record ProcessingJobStartRequest(
                        @NotNull Long rowVersion,
                        BigDecimal actualInputQty,
                        String batchNo,
                        String remarks) {
        }

        public record ProcessingJobCompleteRequest(
                        @NotNull Long rowVersion,
                        @NotNull @DecimalMin(value = "0.0") BigDecimal outputQty,
                        @NotNull @DecimalMin(value = "0.0") BigDecimal wastageQty,
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
                        UUID processingUnitId,
                        String processingUnitCode,
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

        public record ProductionReceiveRequest(
                        @NotNull(message = "Reservation row version is required.") Long rowVersion,
                        String batchNo,
                        String remarks) {
        }

        public record ConsumptionLineRequest(
                        @NotNull UUID requisitionLineId,
                        @NotNull @DecimalMin(value = "0.001") BigDecimal quantity,
                        String batchNo,
                        String remarks) {
        }

        public record ConsumptionRequest(
                        @NotNull UUID requisitionId,
                        String remarks,
                        @NotEmpty List<@Valid ConsumptionLineRequest> lines) {
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
                        String plantCode,
                        String consumedBy,
                        LocalDateTime consumedAt,
                        String remarks,
                        List<ConsumptionLineResponse> lines) {
        }
}
