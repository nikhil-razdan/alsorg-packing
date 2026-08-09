package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomSummaryResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomUpdateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RouteStepRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RouteStepResponse;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.service.matflow.MatFlowBomService;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Engineering BOM + approved routing controller.
 *
 * The HOD approval endpoints are intentionally removed. The workflow is:
 * Engineering submit -> Production approve/return -> Approved.
 */
@RestController
@RequestMapping("/api/matflow/boms")
@PreAuthorize("isAuthenticated()")
public class MatFlowBomController {

    private final MatFlowBomService service;

    public MatFlowBomController(MatFlowBomService service) {
        this.service = service;
    }

    @GetMapping
    public List<BomSummaryResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) MatFlowBomStatus status,
            @RequestParam(required = false, defaultValue = "true") Boolean latestOnly) {
        return service.list(search, status, latestOnly);
    }

    @PostMapping
    public BomDetailResponse create(@Valid @RequestBody BomCreateRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    public BomDetailResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public BomDetailResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody BomUpdateRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/lines")
    public BomDetailResponse addLine(
            @PathVariable UUID id,
            @Valid @RequestBody BomLineRequest request) {
        return service.addLine(id, request);
    }

    @PutMapping("/{id}/lines/{lineId}")
    public BomDetailResponse updateLine(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @Valid @RequestBody BomLineRequest request) {
        return service.updateLine(id, lineId, request);
    }

    @DeleteMapping("/{id}/lines/{lineId}")
    public BomDetailResponse deleteLine(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @RequestParam Long rowVersion) {
        return service.deleteLine(id, lineId, rowVersion);
    }

    @PostMapping("/{id}/submit")
    public BomDetailResponse submit(
            @PathVariable UUID id,
            @Valid @RequestBody BomActionRequest request) {
        return service.submit(id, request);
    }

    @PostMapping("/{id}/production-approve")
    public BomDetailResponse productionApprove(
            @PathVariable UUID id,
            @Valid @RequestBody BomActionRequest request) {
        return service.approveByProduction(id, request);
    }

    @PostMapping("/{id}/production-return")
    public BomDetailResponse productionReturn(
            @PathVariable UUID id,
            @Valid @RequestBody BomActionRequest request) {
        return service.returnByProduction(id, request);
    }

    @PostMapping("/{id}/revisions")
    public BomDetailResponse createRevision(
            @PathVariable UUID id,
            @Valid @RequestBody BomActionRequest request) {
        return service.createRevision(id, request);
    }

    /* -------------------- Approved BOM route -------------------- */

    @GetMapping("/{id}/routes")
    public List<RouteStepResponse> routes(@PathVariable UUID id) {
        return service.listRoutes(id);
    }

    @PostMapping("/{id}/lines/{lineId}/route-steps")
    public RouteStepResponse addRouteStep(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @Valid @RequestBody RouteStepRequest request) {
        return service.addRouteStep(id, lineId, request);
    }

    @PutMapping("/{id}/lines/{lineId}/route-steps/{stepId}")
    public RouteStepResponse updateRouteStep(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @PathVariable UUID stepId,
            @Valid @RequestBody RouteStepRequest request) {
        return service.updateRouteStep(id, lineId, stepId, request);
    }

    @DeleteMapping("/{id}/lines/{lineId}/route-steps/{stepId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRouteStep(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @PathVariable UUID stepId,
            @RequestParam Long rowVersion) {
        service.deleteRouteStep(id, lineId, stepId, rowVersion);
    }
}
