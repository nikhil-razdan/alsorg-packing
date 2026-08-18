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
 *
 * Operational Exception holds are respected here as a final safety net. A
 * processor may still record the factual completion/output of work that already
 * started, but the completed lot will not be auto-released onward while its MR
 * is on hold.
 */
@Service
public class MatFlowWorkflowCoordinatorService {
    private final MatFlowProductionService productionService;
    private final MatFlowMovementService movementService;
    private final MatFlowAuditService auditService;

    public MatFlowWorkflowCoordinatorService(
            MatFlowProductionService productionService,
            MatFlowMovementService movementService,
            MatFlowAuditService auditService) {
        this.productionService = productionService;
        this.movementService = movementService;
        this.auditService = auditService;
    }

    /**
     * A Store sends the current complete reservation lot. Processing is never
     * selected here: the route was already fixed on the BOM material line.
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

    /** AL-P2/3/4 Plant Store explicitly receives the inbound Main Store lot. */
    @Transactional
    public PlanningResponse receiveAtOriginStore(
            UUID reservationId,
            StoreReceiveRequest request) {
        return movementService.receiveStoreReservation(reservationId, request);
    }

    /**
     * Processor completion is a factual execution record. If the linked MR is
     * under an Operational Exception hold, the output remains contained and no
     * automatic onward hand-off occurs. Otherwise the saved route continues.
     */
    @Transactional
    public ProcessingJobResponse completeProcessing(
            UUID jobId,
            ProcessingJobCompleteRequest request) {
        ProcessingJobResponse response = productionService.completeProcessingJob(jobId, request);
        if (response != null && response.reservationId() != null) {
            if (response.requisitionId() != null
                    && auditService.isRequisitionBlocked(response.requisitionId())) {
                auditService.record(
                        "REQUISITION",
                        response.requisitionId(),
                        "PROCESSING_OUTPUT_CONTAINED_BY_EXCEPTION",
                        response.plantCode(),
                        null,
                        null,
                        auditService.details(
                                "processingJobId", jobId,
                                "reservationId", response.reservationId(),
                                "message", "Processing completed factually; onward hand-off was stopped by an active workflow exception."));
                return response;
            }
            movementService.advanceReservationAfterProcessing(
                    response.reservationId(),
                    request == null ? null : request.remarks());
        }
        return response;
    }
}
