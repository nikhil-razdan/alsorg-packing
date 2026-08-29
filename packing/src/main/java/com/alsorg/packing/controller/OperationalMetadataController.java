package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.service.UtlWorkflowService;

/**
 * Read-only operational presentation metadata.
 *
 * Physical PackFlow plant codes stay canonical (AL-P3 / WR-38).  This endpoint
 * exposes only authorized UTL-origin display metadata so React can render
 * "AL-P3 - UTL" / "WR-38 - UTL" without corrupting plant routing, FG,
 * Warehouse, Dispatch, security predicates or historical records.
 */
@RestController
@RequestMapping("/api/operational-metadata")
@PreAuthorize("isAuthenticated()")
public class OperationalMetadataController {

    private final UtlWorkflowService utlWorkflowService;

    public OperationalMetadataController(
            UtlWorkflowService utlWorkflowService) {
        this.utlWorkflowService = utlWorkflowService;
    }

    @PostMapping("/utl-origins")
    public ResponseEntity<List<UtlWorkflowService.UtlOriginMetadata>> getUtlOrigins(
            @RequestBody(required = false) List<String> packetItemIds) {

        return ResponseEntity.ok(
                utlWorkflowService.getVisibleOriginMetadata(
                        packetItemIds));
    }
}
