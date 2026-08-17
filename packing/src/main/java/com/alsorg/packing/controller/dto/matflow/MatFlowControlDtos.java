package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnReason;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PartialAvailabilityDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionType;
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
 * MatFlow control contracts with plant/requester-driven routing.
 * No material-return source/destination Location is accepted from the client.
 */
public final class MatFlowControlDtos {
    private MatFlowControlDtos() {
    }

    public record ReservationReleaseRequest(
            @NotNull(message = "Reservation row version is required.") Long rowVersion,
            @NotNull(message = "Release reason is required.") String reason) {
    }

    public record RequisitionCancelRequest(
            @NotNull(message = "Requisition row version is required.") Long rowVersion,
            @NotNull(message = "Cancellation reason is required.") String reason) {
    }

    /** @deprecated Legacy compatibility only; current workflow does not use this desk. */
    @Deprecated
    public record PartialAvailabilityDecisionRequest(
            @NotNull(message = "Requisition row version is required.") Long rowVersion,
            @NotNull(message = "Production partial-availability decision is required.")
            PartialAvailabilityDecision decision,
            @Size(max = 2000, message = "Decision remarks cannot exceed 2000 characters.") String remarks) {
    }

    public record MaterialReturnLineRequest(
            @NotNull(message = "Requisition material line is required.") UUID requisitionLineId,
            @NotNull(message = "Return quantity is required.")
            @DecimalMin(value = "0.001", inclusive = true, message = "Return quantity must be greater than zero.")
            BigDecimal returnQty,
            String batchNo,
            String remarks) {
    }

    public record MaterialReturnCreateRequest(
            @NotNull(message = "Requisition is required.") UUID requisitionId,
            @NotNull(message = "Return reason is required.") MaterialReturnReason reason,
            String remarks,
            @NotEmpty(message = "At least one return material is required.")
            List<@Valid MaterialReturnLineRequest> lines) {
    }

    public record MaterialReturnActionRequest(
            @NotNull(message = "Material return row version is required.") Long rowVersion,
            String remarks) {
    }

    public record MaterialReturnLineResponse(
            UUID id,
            UUID requisitionLineId,
            UUID materialId,
            String materialCode,
            String materialName,
            BigDecimal returnQty,
            BigDecimal dispatchedQty,
            BigDecimal originStoreReceivedQty,
            BigDecimal forwardedQty,
            BigDecimal receivedQty,
            String uom,
            String batchNo,
            Long rowVersion) {
    }

    public record MaterialReturnResponse(
            UUID id,
            String returnNumber,
            UUID requisitionId,
            String requisitionNumber,
            String productionPlantCode,
            String productionUser,
            String viaStorePlantCode,
            String finalStorePlantCode,
            MaterialReturnReason reason,
            MaterialReturnStatus status,
            String dispatchedBy,
            LocalDateTime dispatchedAt,
            String originStoreReceivedBy,
            LocalDateTime originStoreReceivedAt,
            String forwardedBy,
            LocalDateTime forwardedAt,
            String receivedBy,
            LocalDateTime receivedAt,
            String remarks,
            Long rowVersion,
            List<MaterialReturnLineResponse> lines) {
    }

    /** Historical compatibility only. Active QC is a Main Store check gate. */
    public record QcDispositionRequest(
            Long rowVersion,
            QcDispositionType dispositionType,
            String targetCustody,
            BigDecimal quantity,
            String remarks) {
    }

    public record QcDispositionResponse(
            UUID id,
            String dispositionNumber,
            UUID qcInspectionId,
            QcDispositionType dispositionType,
            QcDispositionStatus status,
            String targetCustody,
            String targetPlantCode,
            BigDecimal dispositionQty,
            UUID generatedReservationId,
            UUID generatedTransferId,
            String decidedBy,
            LocalDateTime decidedAt,
            String remarks,
            Long rowVersion) {
    }
}
