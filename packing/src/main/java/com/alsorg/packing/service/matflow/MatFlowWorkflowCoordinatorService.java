package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StoreIssueRequest;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Atomic orchestration for hidden custody transitions that also create or
 * advance Processing execution.
 *
 * QC is deliberately absent here: QC is now only a check/tick gate. Store owns
 * the saved physical route and Processing may be selected whether QC is
 * required
 * or not.
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
     * Store sends the reservation along the route selected during Store review.
     * If the first destination is Processing, the hidden transfer is received by
     * that unit in the same workflow transaction and the Processing job is queued.
     */
    @Transactional
    public PlanningResponse issueStoreReservation(
            UUID reservationId,
            StoreIssueRequest request) {
        PlanningResponse response = movementService.advanceStoreReservation(reservationId, request);

        UUID processingRouteStepId = movementService.processingRouteStepId(reservationId);
        if (processingRouteStepId != null) {
            productionService.createProcessingJobForReservation(
                    reservationId,
                    processingRouteStepId,
                    request == null ? null : request.remarks());
        }
        return response;
    }

    @Transactional
    public ProcessingJobResponse completeProcessing(
            UUID jobId,
            ProcessingJobCompleteRequest request) {
        ProcessingJobResponse response = productionService.completeProcessingJob(jobId, request);
        if (response != null && response.reservationId() != null) {
            movementService.advanceReservation(
                    response.reservationId(),
                    request == null ? null : request.remarks());
        }
        return response;
    }
}
