package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialResponse;
import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingResponse;

import com.alsorg.packing.service.matflow.MatFlowMasterService;

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
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowMasterController {

    private final MatFlowMasterService service;

    public MatFlowMasterController(
            MatFlowMasterService service) {
        this.service = service;
    }

    @GetMapping("/materials")
    public List<MaterialResponse> materials(
            @RequestParam(required = false) String search,

            @RequestParam(required = false) Boolean active) {
        return service.listMaterials(
                search,
                active);
    }

    @PostMapping("/materials")
    public MaterialResponse createMaterial(
            @RequestBody MaterialRequest request) {
        return service.createMaterial(
                request);
    }

    @PutMapping("/materials/{id}")
    public MaterialResponse updateMaterial(
            @PathVariable UUID id,
            @RequestBody MaterialRequest request) {
        return service.updateMaterial(
                id,
                request);
    }

    @GetMapping("/projects")
    public List<ProjectDrawingResponse> projects(
            @RequestParam(required = false) String search,

            @RequestParam(required = false) Boolean active) {
        return service.listProjects(
                search,
                active);
    }

    @PostMapping("/projects")
    public ProjectDrawingResponse createProject(
            @RequestBody ProjectDrawingRequest request) {
        return service.createProject(
                request);
    }

    @PutMapping("/projects/{id}")
    public ProjectDrawingResponse updateProject(
            @PathVariable UUID id,
            @RequestBody ProjectDrawingRequest request) {
        return service.updateProject(
                id,
                request);
    }
}