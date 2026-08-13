package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.service.matflow.MatFlowSafeDeleteService;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controlled MatFlow hard-delete endpoints.
 *
 * The service behind these endpoints enforces lifecycle safety; these routes do
 * not permit deletion of physical stock movements or immutable history.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowSafeDeleteController {

    private final MatFlowSafeDeleteService service;

    public MatFlowSafeDeleteController(MatFlowSafeDeleteService service) {
        this.service = service;
    }

    @DeleteMapping("/boms/{bomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraftBom(
            @PathVariable UUID bomId,
            @RequestParam Long rowVersion) {
        service.deleteDraftBom(bomId, rowVersion);
    }

    @DeleteMapping("/requisitions/{requisitionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraftRequisition(
            @PathVariable UUID requisitionId,
            @RequestParam Long rowVersion) {
        service.deleteDraftRequisition(requisitionId, rowVersion);
    }

    @DeleteMapping("/material-returns/{materialReturnId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraftMaterialReturn(
            @PathVariable UUID materialReturnId,
            @RequestParam Long rowVersion) {
        service.deleteDraftMaterialReturn(materialReturnId, rowVersion);
    }
}
