package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.service.UtlWorkflowService;

/**
 * Read-only operational presentation metadata.
 *
 * Physical PackFlow plant codes stay canonical (AL-P3 / WR-38). This endpoint
 * exposes only authorized UTL-origin display metadata so clients can render
 * "AL-P3 - UTL" / "WR-38 - UTL" without changing plant routing, FG,
 * Warehouse, Dispatch, security predicates or historical records.
 *
 * IMPORTANT:
 * - Browser/native reads should use GET. It is a safe/read-only request and
 *   therefore does not cross Spring Security's CSRF mutation boundary.
 * - POST is intentionally retained for backward compatibility with older
 *   native clients. No existing caller is broken by this correction.
 * - Row visibility remains enforced inside UtlWorkflowService. This controller
 *   does not broaden UTL visibility or mutation authority.
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

    @GetMapping("/utl-origins")
    public ResponseEntity<List<UtlWorkflowService.UtlOriginMetadata>> getUtlOriginsReadOnly(
            @RequestParam(name = "ids", required = false) List<String> packetItemIds) {

        return noStore(
                utlWorkflowService.getVisibleOriginMetadata(
                        packetItemIds));
    }

    /**
     * Backward-compatible endpoint for clients that already send a JSON body.
     * New read-only clients should use GET /utl-origins?ids=... instead.
     */
    @PostMapping("/utl-origins")
    public ResponseEntity<List<UtlWorkflowService.UtlOriginMetadata>> getUtlOrigins(
            @RequestBody(required = false) List<String> packetItemIds) {

        return noStore(
                utlWorkflowService.getVisibleOriginMetadata(
                        packetItemIds));
    }

    private ResponseEntity<List<UtlWorkflowService.UtlOriginMetadata>> noStore(
            List<UtlWorkflowService.UtlOriginMetadata> body) {

        return ResponseEntity
                .ok()
                .cacheControl(CacheControl.noStore())
                .body(body == null ? List.of() : body);
    }
}
