package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowQcRoutingDtos.QcRoutingRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowQcRoutingDtos.QcRoutingResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcRoutingDecision;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Atomic cross-desk orchestration for business actions that both change a desk
 * state and immediately advance internal material custody.
 */
@Service
public class MatFlowWorkflowCoordinatorService {
    private final MatFlowQcService qcService;
    private final MatFlowProductionService productionService;
    private final MatFlowMovementService movementService;

    public MatFlowWorkflowCoordinatorService(
            MatFlowQcService qcService,
            MatFlowProductionService productionService,
            MatFlowMovementService movementService) {
        this.qcService = qcService;
        this.productionService = productionService;
        this.movementService = movementService;
    }

    @Transactional
    public QcRoutingResponse routeQc(UUID inspectionId, QcRoutingRequest request) {
        QcRoutingResponse response = qcService.route(inspectionId, request);
        if (response != null && response.reservationId() != null) {
            movementService.advanceReservation(response.reservationId(), request == null ? null : request.remarks());
            if (response.routingDecision() == QcRoutingDecision.SEND_TO_PROCESSING
                    && response.selectedProcessingRouteStepId() != null) {
                productionService.createProcessingJobFromQc(
                        response.reservationId(),
                        response.selectedProcessingRouteStepId(),
                        request == null ? null : request.remarks());
            }
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
