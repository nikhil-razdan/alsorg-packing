package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCompleteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ProcessingJobStartRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import com.alsorg.packing.service.matflow.MatFlowProductionService;

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
 * Explicit Production start/complete actions prevent material consumption from
 * silently completing the finished-product workflow.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowProductionController {

    private final MatFlowProductionService service;

    public MatFlowProductionController(MatFlowProductionService service) {
        this.service = service;
    }

    /* -------------------- Processing jobs -------------------- */

    @GetMapping("/processing-jobs")
    public List<ProcessingJobResponse> processingJobs() {
        return service.listProcessingJobs();
    }

    @PostMapping("/processing-jobs")
    public ProcessingJobResponse createProcessingJob(
            @Valid @RequestBody ProcessingJobCreateRequest request) {
        return service.createProcessingJob(request);
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
        return service.completeProcessingJob(id, request);
    }

    /* -------------------- Production lifecycle -------------------- */

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

    /* -------------------- Consumption -------------------- */

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
