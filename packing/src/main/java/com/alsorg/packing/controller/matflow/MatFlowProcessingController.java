package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.*;
import com.alsorg.packing.service.matflow.MatFlowProcessingService;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow/processing-jobs")
@PreAuthorize("isAuthenticated()")
public class MatFlowProcessingController {

    private final MatFlowProcessingService service;

    public MatFlowProcessingController(
            MatFlowProcessingService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProcessingJobResponse> list() {
        return service.list();
    }

    @PostMapping
    public ProcessingJobResponse create(
            @RequestBody ProcessingJobCreateRequest request) {
        return service.create(request);
    }

    @PostMapping("/{id}/start")
    public ProcessingJobResponse start(
            @PathVariable UUID id,
            @RequestBody ProcessingJobStartRequest request) {
        return service.start(id, request);
    }

    @PostMapping("/{id}/complete")
    public ProcessingJobResponse complete(
            @PathVariable UUID id,
            @RequestBody ProcessingJobCompleteRequest request) {
        return service.complete(id, request);
    }
}