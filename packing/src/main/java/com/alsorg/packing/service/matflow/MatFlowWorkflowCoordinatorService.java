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
     * A Store sends the current complete reservation lot. At AL-P1 Main Store
     * that may mean Main Store -> Processing, Main Store -> origin Plant Store,
     * or Main Store -> AL-P1 Production. At AL-P2/3/4 Store it means the final
     * Plant Store -> specific Production user handover.
     */
    @Transactional
    public PlanningResponse issueStoreReservation(
            UUID reservationId,
            StoreIssueRequest request) {
        PlanningResponse response = movementService.advanceStoreReservation(reservationId, request);

        /*
         * Idempotent: once a Processing destination has actually received the lot,
         * createProcessingJobForReservation returns the existing job on later calls.
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
     * Processor completes the job and the output is returned into AL-P1 Main
     * Store custody. The next plant-issue leg becomes ready but is not silently
     * dispatched on behalf of Main Store.
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
