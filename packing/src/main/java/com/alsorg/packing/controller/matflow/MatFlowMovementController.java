package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.MaterialReturnResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.TransferResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Physical movement controller: route transfers + Production material returns.
 *
 * Direct reservation issue is intentionally not exposed here; Store issue is
 * owned only by MatFlowRequisitionController/MatFlowRequisitionService.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowMovementController {

    private final MatFlowMovementService service;

    public MatFlowMovementController(MatFlowMovementService service) {
        this.service = service;
    }

    /* -------------------- Transfers -------------------- */

    @GetMapping("/transfers")
    public List<TransferResponse> transfers(
            @RequestParam(required = false) TransferStatus status,
            @RequestParam(required = false) String plantCode) {
        return service.listTransfers(status, plantCode);
    }

    @GetMapping("/transfers/{id}")
    public TransferResponse transfer(@PathVariable UUID id) {
        return service.getTransfer(id);
    }

    @PostMapping("/transfers/{id}/dispatch")
    public TransferResponse dispatchTransfer(
            @PathVariable UUID id,
            @Valid @RequestBody TransferActionRequest request) {
        return service.dispatchTransfer(id, request);
    }

    @PostMapping("/transfers/{id}/receive")
    public TransferResponse receiveTransfer(
            @PathVariable UUID id,
            @Valid @RequestBody TransferActionRequest request) {
        return service.receiveTransfer(id, request);
    }

    /* -------------------- Production material returns -------------------- */

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
