package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductApprovalRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectPortfolioResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectRequest;
import com.alsorg.packing.service.matflow.MatFlowProjectService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** True Project -> Products aggregate API. */
@RestController
@RequestMapping("/api/matflow/project-portfolio")
@PreAuthorize("isAuthenticated()")
public class MatFlowProjectController {

    private final MatFlowProjectService service;

    public MatFlowProjectController(MatFlowProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProjectPortfolioResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String plantCode) {
        return service.list(search, active, plantCode);
    }

    @GetMapping("/{projectId}")
    public ProjectPortfolioResponse get(@PathVariable UUID projectId) {
        return service.get(projectId);
    }

    @PostMapping
    public ProjectPortfolioResponse create(@RequestBody ProjectRequest request) {
        return service.create(request);
    }

    @PutMapping("/{projectId}")
    public ProjectPortfolioResponse update(
            @PathVariable UUID projectId,
            @RequestBody ProjectRequest request) {
        return service.update(projectId, request);
    }

    @DeleteMapping("/{projectId}")
    public void deleteProject(
            @PathVariable UUID projectId,
            @RequestParam Long rowVersion) {
        service.deleteProject(projectId, rowVersion);
    }

    @PostMapping("/{projectId}/products")
    public ProjectPortfolioResponse addProduct(
            @PathVariable UUID projectId,
            @RequestBody ProductRequest request) {
        return service.addProduct(projectId, request);
    }

    @PutMapping("/{projectId}/products/{productId}")
    public ProjectPortfolioResponse updateProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestBody ProductRequest request) {
        return service.updateProduct(projectId, productId, request);
    }

    @DeleteMapping("/{projectId}/products/{productId}")
    public ProjectPortfolioResponse deleteProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestParam Long rowVersion) {
        return service.deleteProduct(projectId, productId, rowVersion);
    }

    @PostMapping("/{projectId}/products/{productId}/approve")
    public ProjectPortfolioResponse approveProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestBody ProductApprovalRequest request) {
        return service.approveProduct(projectId, productId, request);
    }

    @PostMapping("/{projectId}/products/{productId}/return")
    public ProjectPortfolioResponse returnProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestBody ProductApprovalRequest request) {
        return service.returnProduct(projectId, productId, request);
    }
}