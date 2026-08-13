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
import com.alsorg.packing.service.matflow.MatFlowSafeDeleteService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Product-specific Operational BOM controller.
 * Workflow: Engineering submit -> Production review/return. Production review
 * makes the revision effective.
 */
@RestController
@RequestMapping("/api/matflow/boms")
@PreAuthorize("isAuthenticated()")
public class MatFlowBomController {

    private final MatFlowBomService service;
    private final MatFlowSafeDeleteService safeDeleteService;

    public MatFlowBomController(
            MatFlowBomService service,
            MatFlowSafeDeleteService safeDeleteService) {
        this.service = service;
        this.safeDeleteService = safeDeleteService;
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
    public BomDetailResponse update(@PathVariable UUID id, @Valid @RequestBody BomUpdateRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/lines")
    public BomDetailResponse addLine(@PathVariable UUID id, @Valid @RequestBody BomLineRequest request) {
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

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraftBom(
            @PathVariable UUID id,
            @RequestParam Long rowVersion) {
        safeDeleteService.deleteDraftBom(id, rowVersion);
    }

    @PostMapping("/{id}/submit")
    public BomDetailResponse submit(@PathVariable UUID id, @Valid @RequestBody BomActionRequest request) {
        return service.submit(id, request);
    }

    @PostMapping("/{id}/production-review")
    public BomDetailResponse productionReview(
            @PathVariable UUID id,
            @Valid @RequestBody BomActionRequest request) {
        return service.reviewByProduction(id, request);
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
