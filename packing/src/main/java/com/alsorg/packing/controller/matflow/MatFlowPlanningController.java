package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.PlanningResponse;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionActionRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionCreateRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RequisitionResponse;

import com.alsorg.packing.service.matflow.MatFlowPlanningService;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow/requisitions")
@PreAuthorize("isAuthenticated()")
public class MatFlowPlanningController {

    private final MatFlowPlanningService service;

    public MatFlowPlanningController(
            MatFlowPlanningService service) {
        this.service = service;
    }

    @GetMapping
    public List<RequisitionResponse> list() {
        return service.listRequisitions();
    }

    @GetMapping("/{id}")
    public RequisitionResponse get(
            @PathVariable UUID id) {
        return service.getRequisition(id);
    }

    @PostMapping
    public RequisitionResponse create(
            @RequestBody RequisitionCreateRequest request) {
        return service.createRequisition(
                request);
    }

    @PostMapping("/{id}/submit")
    public RequisitionResponse submit(
            @PathVariable UUID id,
            @RequestBody RequisitionActionRequest request) {
        return service.submitRequisition(
                id,
                request);
    }

    @PostMapping("/{id}/plan")
    public PlanningResponse plan(
            @PathVariable UUID id,
            @RequestBody PlanningRequest request) {
        return service.planRequisition(
                id,
                request);
    }
}