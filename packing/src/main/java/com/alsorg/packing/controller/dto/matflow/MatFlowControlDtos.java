package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnReason;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PartialAvailabilityDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Control/correction contracts that do not create parallel workflow desks. */
public final class MatFlowControlDtos {
    private MatFlowControlDtos() {
    }

    public record ReservationReleaseRequest(Long rowVersion, String reason) {
    }

    public record RequisitionCancelRequest(Long rowVersion, String reason) {
    }

    /**
     * Legacy wire compatibility only. The active four-plant workflow does not
     * require a separate Production partial-availability decision, but keeping
     * this contract avoids breaking older callers that still compile against it.
     */
    public record PartialAvailabilityDecisionRequest(
            @NotNull(message = "Requisition row version is required.") Long rowVersion,
            @NotNull(message = "Production partial-availability decision is required.") PartialAvailabilityDecision decision,
            @Size(max = 2000, message = "Decision remarks cannot exceed 2000 characters.") String remarks) {
    }

    public record MaterialReturnLineRequest(
            UUID requisitionLineId,
            BigDecimal returnQty,
            String batchNo,
            String remarks) {
    }

    /**
     * toLocationId is retained for wire compatibility. The backend now fixes the
     * final destination to AL-P1 Main Store; null is allowed and a supplied value
     * must resolve to that same Main Store.
     */
    public record MaterialReturnCreateRequest(
            UUID requisitionId,
            UUID fromLocationId,
            UUID toLocationId,
            MaterialReturnReason reason,
            String remarks,
            List<MaterialReturnLineRequest> lines) {
    }

    /**
     * The same action contract is used for each custody leg. For a remote return,
     * dispatch is called once by Production and once by the origin Plant Store;
     * receive is called once by the origin Plant Store and once by AL-P1 Main Store.
     */
    public record MaterialReturnActionRequest(Long rowVersion, String remarks) {
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

    /** One return document with an optional remote origin-Store routing leg. */
    public record MaterialReturnResponse(
            UUID id,
            String returnNumber,
            UUID requisitionId,
            String requisitionNumber,
            UUID fromLocationId,
            String fromLocationCode,
            String fromPlantCode,
            UUID viaLocationId,
            String viaLocationCode,
            String viaPlantCode,
            UUID toLocationId,
            String toLocationCode,
            String toPlantCode,
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

    public record QcDispositionRequest(
            Long rowVersion,
            QcDispositionType dispositionType,
            UUID targetLocationId,
            BigDecimal quantity,
            String remarks) {
    }

    public record QcDispositionResponse(
            UUID id,
            String dispositionNumber,
            UUID qcInspectionId,
            QcDispositionType dispositionType,
            QcDispositionStatus status,
            UUID targetLocationId,
            String targetLocationCode,
            BigDecimal dispositionQty,
            UUID generatedReservationId,
            UUID generatedTransferId,
            String decidedBy,
            LocalDateTime decidedAt,
            String remarks,
            Long rowVersion) {
    }
}
