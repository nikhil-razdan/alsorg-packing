package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnReason;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionType;
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

    public record MaterialReturnLineRequest(
            UUID requisitionLineId,
            BigDecimal returnQty,
            String batchNo,
            String remarks) {
    }

    public record MaterialReturnCreateRequest(
            UUID requisitionId,
            UUID fromLocationId,
            UUID toLocationId,
            MaterialReturnReason reason,
            String remarks,
            List<MaterialReturnLineRequest> lines) {
    }

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
            UUID fromLocationId,
            String fromLocationCode,
            String fromPlantCode,
            UUID toLocationId,
            String toLocationCode,
            String toPlantCode,
            MaterialReturnReason reason,
            MaterialReturnStatus status,
            String dispatchedBy,
            LocalDateTime dispatchedAt,
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
