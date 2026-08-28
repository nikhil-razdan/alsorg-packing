package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
                        @DecimalMin(value = "0.001", inclusive = true, message = "Planned input quantity must be greater than zero.")
                        BigDecimal plannedInputQty,
                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record ProcessingJobStartRequest(
                        @NotNull(message = "Processing job row version is required.") Long rowVersion,
                        @DecimalMin(value = "0.001", inclusive = true, message = "Actual input quantity must be greater than zero.")
                        BigDecimal actualInputQty,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record ProcessingJobCompleteRequest(
                        @NotNull(message = "Processing job row version is required.") Long rowVersion,
                        @NotNull(message = "Output quantity is required.")
                        @DecimalMin(value = "0.0", inclusive = true, message = "Output quantity cannot be negative.")
                        BigDecimal outputQty,
                        @NotNull(message = "Wastage quantity is required.")
                        @DecimalMin(value = "0.0", inclusive = true, message = "Wastage quantity cannot be negative.")
                        BigDecimal wastageQty,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks) {
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
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks) {
        }

        public record ConsumptionLineRequest(
                        @NotNull(message = "Requisition material line is required.") UUID requisitionLineId,
                        @NotNull(message = "Consumption quantity is required.")
                        @DecimalMin(value = "0.001", inclusive = true, message = "Consumption quantity must be greater than zero.")
                        BigDecimal quantity,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo,
                        @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
        }

        public record ConsumptionRequest(
                        @NotNull(message = "Requisition is required.") UUID requisitionId,
                        @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.") String remarks,
                        @NotEmpty(message = "At least one consumption line is required.")
                        @Size(max = 500, message = "A maximum of 500 consumption lines is allowed.")
                        List<@Valid ConsumptionLineRequest> lines) {
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
