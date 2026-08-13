package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnResponse;
import com.alsorg.packing.service.matflow.MatFlowMovementService;
import com.alsorg.packing.service.matflow.MatFlowSafeDeleteService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Production material-return boundary; no public Transfer document API exists. */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowMovementController {
    private final MatFlowMovementService service;
    private final MatFlowSafeDeleteService safeDeleteService;

    public MatFlowMovementController(
            MatFlowMovementService service,
            MatFlowSafeDeleteService safeDeleteService) {
        this.service = service;
        this.safeDeleteService = safeDeleteService;
    }

    @GetMapping("/material-returns")
    public List<MaterialReturnResponse> materialReturns() {
        return service.listReturns();
    }

    @PostMapping("/material-returns")
    public MaterialReturnResponse createReturn(
            @Valid @RequestBody MaterialReturnCreateRequest request) {
        return service.createReturn(request);
    }

    @DeleteMapping("/material-returns/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraftReturn(
            @PathVariable UUID id,
            @RequestParam Long rowVersion) {
        safeDeleteService.deleteDraftMaterialReturn(id, rowVersion);
    }

    @PostMapping("/material-returns/{id}/dispatch")
    public MaterialReturnResponse dispatchReturn(
            @PathVariable UUID id,
            @Valid @RequestBody MaterialReturnActionRequest request) {
        return service.dispatchReturn(id, request);
    }

    @PostMapping("/material-returns/{id}/receive")
    public MaterialReturnResponse receiveReturn(
            @PathVariable UUID id,
            @Valid @RequestBody MaterialReturnActionRequest request) {
        return service.receiveReturn(id, request);
    }
}
