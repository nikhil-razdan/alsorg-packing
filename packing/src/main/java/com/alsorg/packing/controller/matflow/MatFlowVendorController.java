package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorResponse;
import com.alsorg.packing.service.matflow.MatFlowVendorService;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow/vendors")
@PreAuthorize("isAuthenticated()")
public class MatFlowVendorController {

    private final MatFlowVendorService service;

    public MatFlowVendorController(
            MatFlowVendorService service) {
        this.service = service;
    }

    @GetMapping
    public List<VendorResponse> list(
            @RequestParam(required = false) String search,

            @RequestParam(required = false) Boolean active) {
        return service.list(search, active);
    }

    @PostMapping
    public VendorResponse create(
            @RequestBody VendorRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public VendorResponse update(
            @PathVariable UUID id,
            @RequestBody VendorRequest request) {
        return service.update(id, request);
    }
}