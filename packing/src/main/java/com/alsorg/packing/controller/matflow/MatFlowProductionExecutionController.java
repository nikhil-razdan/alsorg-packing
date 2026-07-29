package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowExecutionDtos.ConsumptionResponse;
import com.alsorg.packing.service.matflow.MatFlowProductionExecutionService;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow/production-consumptions")
@PreAuthorize("isAuthenticated()")
public class MatFlowProductionExecutionController {

    private final MatFlowProductionExecutionService service;

    public MatFlowProductionExecutionController(
            MatFlowProductionExecutionService service) {
        this.service = service;
    }

    @GetMapping
    public List<ConsumptionResponse> list() {
        return service.list();
    }

    @PostMapping
    public ConsumptionResponse consume(
            @RequestBody ConsumptionRequest request) {
        return service.consume(request);
    }
}