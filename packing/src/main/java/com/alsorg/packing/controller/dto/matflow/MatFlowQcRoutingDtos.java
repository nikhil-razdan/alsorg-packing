package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcRoutingDecision;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Dedicated contract for the post-inspection QC routing gate. */
public final class MatFlowQcRoutingDtos {
        private MatFlowQcRoutingDtos() {
        }

        public record QcRoutingRequest(
                        Long rowVersion,
                        QcRoutingDecision routingDecision,
                        UUID processingRouteStepId,
                        String remarks) {
        }

        public record ProcessingRouteOption(
                        UUID routeStepId,
                        UUID locationId,
                        String locationCode,
                        String locationName,
                        String plantCode,
                        String processCode,
                        Integer sequenceNo) {
        }

        public record QcRoutingResponse(
                        UUID inspectionId,
                        UUID requisitionId,
                        String requisitionNumber,
                        UUID reservationId,
                        boolean routingRequired,
                        boolean routingComplete,
                        QcRoutingDecision routingDecision,
                        UUID selectedProcessingRouteStepId,
                        String routedBy,
                        LocalDateTime routedAt,
                        String routingRemarks,
                        UUID currentLocationId,
                        String currentLocationCode,
                        UUID productionLocationId,
                        String productionLocationCode,
                        UUID nextTransferId,
                        String nextTransferNumber,
                        List<ProcessingRouteOption> processingOptions,
                        Long rowVersion) {
        }
}
