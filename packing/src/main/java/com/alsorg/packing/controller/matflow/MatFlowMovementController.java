package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnResponse;
import com.alsorg.packing.service.matflow.MatFlowMovementService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Production material-return boundary.
 *
 * The user supplies MR + quantities only. The service derives the complete
 * reverse path from the MR plant/requester: P1 Production -> Main Store, or
 * remote Production -> own Store -> AL-P1 Main Store.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowMovementController {
    private final MatFlowMovementService service;

    public MatFlowMovementController(MatFlowMovementService service) {
        this.service = service;
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
