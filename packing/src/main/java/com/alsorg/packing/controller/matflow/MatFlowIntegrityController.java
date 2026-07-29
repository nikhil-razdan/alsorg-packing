package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegrityReport;
import com.alsorg.packing.service.matflow.MatFlowIntegrityService;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow/admin/integrity")
@PreAuthorize("isAuthenticated()")
public class MatFlowIntegrityController {

    private final MatFlowIntegrityService service;

    public MatFlowIntegrityController(
            MatFlowIntegrityService service) {
        this.service = service;
    }

    @GetMapping
    public IntegrityReport inspect(
            @RequestParam(required = false) String plantCode) {
        return service.inspect(
                plantCode);
    }
}