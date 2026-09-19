package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.service.matflow.MatFlowPermanentDeleteService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @DeleteMapping("/projects/{projectId}/products/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId) {
        service.permanentlyDeleteProduct(projectId, productId);
    }

    @DeleteMapping("/boms/{bomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void permanentlyDeleteBom(@PathVariable UUID bomId) {
        service.permanentlyDeleteBom(bomId);
    }
}
