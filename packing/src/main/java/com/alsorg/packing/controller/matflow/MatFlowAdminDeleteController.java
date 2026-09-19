package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.service.matflow.MatFlowPermanentDeleteService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** ADMIN-only irreversible MatFlow delete boundary. */
@RestController
@RequestMapping("/api/matflow/admin/permanent-delete")
@PreAuthorize("hasAuthority('ADMIN')")
public class MatFlowAdminDeleteController {

    private final MatFlowPermanentDeleteService service;

    public MatFlowAdminDeleteController(MatFlowPermanentDeleteService service) {
        this.service = service;
    }

    @DeleteMapping("/projects/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteProject(@PathVariable UUID projectId) {
        service.permanentlyDeleteProject(projectId);
    }

    @PostMapping("/projects/bulk")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteProjects(
            @RequestBody(required = false) BulkProjectDeleteRequest request) {
        service.permanentlyDeleteProjects(request == null ? null : request.projectIds());
    }

    @DeleteMapping("/projects/{projectId}/products/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId) {
        service.permanentlyDeleteProduct(projectId, productId);
    }

    @PostMapping("/products/bulk")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteProducts(
            @RequestBody(required = false) BulkProductDeleteRequest request) {
        service.permanentlyDeleteProducts(
                request == null ? null : request.projectId(),
                request == null ? null : request.productIds());
    }

    @DeleteMapping("/boms/{bomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteBom(@PathVariable UUID bomId) {
        service.permanentlyDeleteBom(bomId);
    }

    @PostMapping("/boms/bulk")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteBoms(
            @RequestBody(required = false) BulkBomDeleteRequest request) {
        service.permanentlyDeleteBoms(request == null ? null : request.bomIds());
    }

    public record BulkProjectDeleteRequest(List<UUID> projectIds) {}

    public record BulkProductDeleteRequest(UUID projectId, List<UUID> productIds) {}

    public record BulkBomDeleteRequest(List<UUID> bomIds) {}
}
