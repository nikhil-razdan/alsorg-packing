package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcRoutingDecision;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Legacy QC-routing compatibility contracts.
 *
 * New MatFlow QC is a simple Main-Store check gate and normal clients do not
 * need this route API. These records deliberately expose business custody /
 * Processing Unit terminology only; no generic Location contract is public.
 */
public final class MatFlowQcRoutingDtos {
        private MatFlowQcRoutingDtos() {
        }

        public record ProcessingRouteOption(
                        UUID routeStepId,
                        UUID processingUnitId,
                        String processingUnitCode,
                        String processingUnitName,
                        String plantCode,
                        String processCode,
                        Integer sequenceNo) {
        }

        public record QcRoutingRequest(
                        @NotNull(message = "QC row version is required.") Long rowVersion,
                        @NotNull(message = "QC routing decision is required.") QcRoutingDecision routingDecision,
                        UUID processingRouteStepId,
                        String remarks) {
        }

        public record QcRoutingResponse(
                        UUID id,
                        UUID requisitionId,
                        String requisitionNumber,
                        UUID reservationId,
                        boolean routingRequired,
                        boolean routed,
                        QcRoutingDecision routingDecision,
                        UUID processingRouteStepId,
                        String routedBy,
                        LocalDateTime routedAt,
                        String remarks,
                        String currentCustody,
                        String currentPlantCode,
                        String productionUser,
                        String productionPlantCode,
                        List<ProcessingRouteOption> processingOptions,
                        Long rowVersion) {
        }
}
