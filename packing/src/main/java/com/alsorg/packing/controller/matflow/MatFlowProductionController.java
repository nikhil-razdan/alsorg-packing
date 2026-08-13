package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobStartRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProductionReceiveRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProductionWasteDtos.ProductionWasteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProductionWasteDtos.ProductionWasteResponse;
import com.alsorg.packing.service.matflow.MatFlowMovementService;
import com.alsorg.packing.service.matflow.MatFlowProductionService;
import com.alsorg.packing.service.matflow.MatFlowWorkflowCoordinatorService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Processing + Production execution controller.
 *
 * Processing jobs are queued only by QC routing. Processing completes the job
 * and sends the material onward. Production explicitly receives each arriving
 * material lot, then starts, consumes/wastes/returns and completes the MR.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowProductionController {
    private final MatFlowProductionService service;
    private final MatFlowWorkflowCoordinatorService workflow;
    private final MatFlowMovementService movementService;

    public MatFlowProductionController(
            MatFlowProductionService service,
            MatFlowWorkflowCoordinatorService workflow,
            MatFlowMovementService movementService) {
        this.service = service;
        this.workflow = workflow;
        this.movementService = movementService;
    }

    @GetMapping("/processing-jobs")
    public List<ProcessingJobResponse> processingJobs() {
        return service.listProcessingJobs();
    }

    @PostMapping("/processing-jobs/{id}/start")
    public ProcessingJobResponse startProcessingJob(
            @PathVariable UUID id,
            @Valid @RequestBody ProcessingJobStartRequest request) {
        return service.startProcessingJob(id, request);
    }

    @PostMapping("/processing-jobs/{id}/complete")
    public ProcessingJobResponse completeProcessingJob(
            @PathVariable UUID id,
            @Valid @RequestBody ProcessingJobCompleteRequest request) {
        return workflow.completeProcessing(id, request);
    }

    /**
     * Production acknowledgement for a lot already sent by Store/QC/Processing.
     * This is a Production business action, not a generic transfer receipt desk.
     */
    @PostMapping("/production/reservations/{reservationId}/receive")
    public PlanningResponse receiveProductionMaterial(
            @PathVariable UUID reservationId,
            @Valid @RequestBody ProductionReceiveRequest request) {
        return movementService.receiveProductionReservation(reservationId, request);
    }

    @PostMapping("/requisitions/{id}/production/start")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void startProduction(
            @PathVariable UUID id,
            @Valid @RequestBody RequisitionActionRequest request) {
        service.startProduction(id, request);
    }

    @PostMapping("/requisitions/{id}/production/complete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void completeProduction(
            @PathVariable UUID id,
            @Valid @RequestBody RequisitionActionRequest request) {
        service.completeProduction(id, request);
    }

    @PostMapping("/production-wastages")
    public ProductionWasteResponse recordWastage(
            @Valid @RequestBody ProductionWasteRequest request) {
        return service.recordProductionWaste(request);
    }

    @GetMapping("/production-consumptions")
    public List<ConsumptionResponse> consumptions() {
        return service.listConsumptions();
    }

    @PostMapping("/production-consumptions")
    public ConsumptionResponse consume(
            @Valid @RequestBody ConsumptionRequest request) {
        return service.consume(request);
    }
}
