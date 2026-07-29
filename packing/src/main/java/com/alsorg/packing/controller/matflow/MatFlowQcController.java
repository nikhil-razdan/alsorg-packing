package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.service.matflow.MatFlowQcService;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow/qc")
@PreAuthorize("isAuthenticated()")
public class MatFlowQcController {

    private final MatFlowQcService service;

    public MatFlowQcController(
            MatFlowQcService service) {
        this.service = service;
    }

    @GetMapping
    public List<QcInspectionResponse> list(
            @RequestParam(required = false) QcInspectionStatus status) {
        return service.list(status);
    }

    @PostMapping("/{id}/decision")
    public QcInspectionResponse decide(
            @PathVariable UUID id,
            @RequestBody QcDecisionRequest request) {
        return service.decide(id, request);
    }

    @PostMapping("/{id}/return-to-vendor")
    public VendorReturnResponse returnToVendor(
            @PathVariable UUID id,
            @RequestBody VendorReturnRequest request) {
        return service.returnToVendor(
                id,
                request);
    }
}