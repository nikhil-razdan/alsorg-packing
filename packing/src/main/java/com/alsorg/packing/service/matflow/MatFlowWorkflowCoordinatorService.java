package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreReceiveRequest;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Atomic orchestration for the hidden custody legs in the four-plant MatFlow
 * route. There is still no public Transfers desk.
 */
@Service
public class MatFlowWorkflowCoordinatorService {
    private final MatFlowProductionService productionService;
    private final MatFlowMovementService movementService;

    public MatFlowWorkflowCoordinatorService(
            MatFlowProductionService productionService,
            MatFlowMovementService movementService) {
        this.productionService = productionService;
        this.movementService = movementService;
    }

    /**
     * A Store sends the current complete reservation lot. Processing is never
     * selected here: the route was already fixed on the BOM material line.
     * A BOM-processed lot goes to that Processing Unit; a non-processed lot
     * follows the normal Store -> Production route (including the remote Plant
     * Store hop where applicable).
     */
    @Transactional
    public PlanningResponse issueStoreReservation(
            UUID reservationId,
            StoreIssueRequest request) {
        PlanningResponse response = movementService.advanceStoreReservation(reservationId, request);

        /*
         * Idempotent: when the BOM-defined Processing destination has physically
         * received the lot, queue its job automatically. Repeated calls return the
         * same reservation/route-step job instead of creating duplicates.
         */
        UUID processingRouteStepId = movementService.processingRouteStepId(reservationId);
        if (processingRouteStepId != null) {
            productionService.createProcessingJobForReservation(
                    reservationId,
                    processingRouteStepId,
                    request == null ? null : request.remarks());
        }
        return response;
    }

    /** AL-P2/3/4 Plant Store explicitly receives the inbound Main Store lot. */
    @Transactional
    public PlanningResponse receiveAtOriginStore(
            UUID reservationId,
            StoreReceiveRequest request) {
        return movementService.receiveStoreReservation(reservationId, request);
    }

    /**
     * Processor completion is the only Processing execution decision. After the
     * job is completed, its output is automatically handed to the exact MR
     * Production destination; it does not return to Main Store for a second
     * routing/selection decision.
     */
    @Transactional
    public ProcessingJobResponse completeProcessing(
            UUID jobId,
            ProcessingJobCompleteRequest request) {
        ProcessingJobResponse response = productionService.completeProcessingJob(jobId, request);
        if (response != null && response.reservationId() != null) {
            movementService.advanceReservationAfterProcessing(
                    response.reservationId(),
                    request == null ? null : request.remarks());
        }
        return response;
    }
}
