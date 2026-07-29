package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowMetadataDtos.MetadataResponse;
import com.alsorg.packing.service.matflow.MatFlowMetadataService;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow/meta")
@PreAuthorize("isAuthenticated()")
public class MatFlowMetadataController {

    private final MatFlowMetadataService service;

    public MatFlowMetadataController(
            MatFlowMetadataService service) {
        this.service = service;
    }

    @GetMapping
    public MetadataResponse metadata() {
        return service.metadata();
    }
}