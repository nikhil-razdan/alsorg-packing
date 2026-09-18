package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowDesignProjectDtos.*;

import com.alsorg.packing.service.matflow.MatFlowDesignProjectService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow/design-projects")
@PreAuthorize("isAuthenticated()")
public class MatFlowDesignProjectController {
    private final MatFlowDesignProjectService service;

    public MatFlowDesignProjectController(MatFlowDesignProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<DesignProjectResponse> list(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String assignee,
            @RequestParam(required = false) String status) {
        return service.list(plantCode, search, assignee, status);
    }

    @GetMapping("/{projectId}")
    public DesignProjectResponse get(@PathVariable UUID projectId) {
        return service.get(projectId);
    }

    @PutMapping("/{projectId}/assignment")
    public DesignProjectResponse assign(@PathVariable UUID projectId, @RequestBody AssignmentRequest request) {
        return service.assign(projectId, request);
    }

    @PutMapping("/{projectId}/checklist/{itemKey}")
    public DesignProjectResponse checklist(
            @PathVariable UUID projectId,
            @PathVariable String itemKey,
            @RequestBody ChecklistUpdateRequest request) {
        return service.updateChecklist(projectId, itemKey, request);
    }

    @PostMapping("/{projectId}/checklist/lock")
    public DesignProjectResponse checklistLock(@PathVariable UUID projectId, @RequestBody ChecklistLockRequest request) {
        return service.setChecklistLock(projectId, request);
    }

    @PutMapping("/{projectId}/products/{productId}/progress")
    public DesignProjectResponse productProgress(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestBody ProductProgressRequest request) {
        return service.updateProductProgress(projectId, productId, request);
    }

    @PostMapping("/{projectId}/logs")
    public DesignProjectResponse log(@PathVariable UUID projectId, @RequestBody LogRequest request) {
        return service.addLog(projectId, request);
    }
}
