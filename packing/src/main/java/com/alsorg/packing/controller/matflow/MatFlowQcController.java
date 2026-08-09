package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcDecisionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcInspectionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.service.matflow.MatFlowQcService;

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
 * Consolidated QC controller for inspections, vendor rejection returns and
 * internal rejected-material dispositions.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowQcController {

    private final MatFlowQcService service;

    public MatFlowQcController(MatFlowQcService service) {
        this.service = service;
    }

    @GetMapping("/qc")
    public List<QcInspectionResponse> inspections(
            @RequestParam(required = false) QcInspectionStatus status) {
        return service.listInspections(status);
    }

    @PostMapping("/qc/{id}/decision")
    public QcInspectionResponse decide(
            @PathVariable UUID id,
            @Valid @RequestBody QcDecisionRequest request) {
        return service.decide(id, request);
    }

    @PostMapping("/qc/{id}/return-to-vendor")
    public VendorReturnResponse returnToVendor(
            @PathVariable UUID id,
            @Valid @RequestBody VendorReturnRequest request) {
        return service.returnToVendor(id, request);
    }

    @GetMapping("/qc-dispositions")
    public List<QcDispositionResponse> dispositions() {
        return service.listDispositions();
    }

    @PostMapping("/qc-dispositions/{inspectionId}")
    public QcDispositionResponse decideDisposition(
            @PathVariable UUID inspectionId,
            @Valid @RequestBody QcDispositionRequest request) {
        return service.decideDisposition(inspectionId, request);
    }
}
