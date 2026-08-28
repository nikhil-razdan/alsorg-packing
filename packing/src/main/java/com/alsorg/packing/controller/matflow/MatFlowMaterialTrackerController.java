package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialTrackerDtos.MaterialTrackerResponse;
import com.alsorg.packing.service.matflow.MatFlowMaterialTrackerService;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Material-centric professional tracker.
 *
 * Read-only by design: all physical movement remains owned by the existing
 * MatFlow transactional controllers/services.
 */
@RestController
@RequestMapping("/api/matflow/tracker/materials")
@PreAuthorize("isAuthenticated()")
public class MatFlowMaterialTrackerController {

    private final MatFlowMaterialTrackerService service;

    public MatFlowMaterialTrackerController(MatFlowMaterialTrackerService service) {
        this.service = service;
    }

    @GetMapping("/{materialId}")
    public MaterialTrackerResponse materialTracker(
            @PathVariable UUID materialId,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly) {
        validateText(plantCode, 32, "Plant code");
        return service.track(materialId, plantCode, activeOnly);
    }
    private void validateText(String value, int maxLength, String fieldName) {
        if (value != null && value.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    fieldName + " cannot exceed " + maxLength + " characters");
        }
    }

}
