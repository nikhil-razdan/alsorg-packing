package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.scan.BulkScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanResolveResponse;
import com.alsorg.packing.security.JwtUtil;
import com.alsorg.packing.service.ScannerDispatchService;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/scanner")
public class ScannerDispatchController {

    private final ScannerDispatchService scannerDispatchService;

    public ScannerDispatchController(
            ScannerDispatchService scannerDispatchService
    ) {
        this.scannerDispatchService = scannerDispatchService;
    }

    /* ===================== RESOLVE QR ===================== */

    @PostMapping("/resolve")
    public ResponseEntity<ScanResolveResponse> resolve(
            @RequestBody ScanRequest request,
            @RequestHeader("Authorization") String auth
    ) {
        String token = extractToken(auth);

        String role = JwtUtil.getRole(token);

        if (!"DISPATCH".equals(role) && !"ADMIN".equals(role)) {
            return ResponseEntity.status(403).build();
        }

        return ResponseEntity.ok(
                scannerDispatchService.resolveScan(request.getScanText())
        );
    }

    /* ===================== SINGLE QR DISPATCH ===================== */

    @PostMapping(
            value = "/dispatch-single",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> dispatchSingle(
            @RequestBody ScanRequest request,
            @RequestHeader("Authorization") String auth,
            @RequestParam(defaultValue = "true") boolean preview
    ) {
        String token = extractToken(auth);

        if (!"DISPATCH".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        byte[] pdf =
                scannerDispatchService.dispatchSingleByScan(
                        request.getScanText(),
                        JwtUtil.getUsername(token)
                );

        return ResponseEntity.ok()
                .header(
                        "Content-Disposition",
                        preview
                                ? "inline; filename=qr-chalaan.pdf"
                                : "attachment; filename=qr-chalaan.pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    /* ===================== BULK QR DISPATCH ===================== */

    @PostMapping(
            value = "/dispatch-bulk",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> dispatchBulk(
            @RequestBody BulkScanRequest request,
            @RequestHeader("Authorization") String auth,
            @RequestParam(defaultValue = "true") boolean preview
    ) {
        String token = extractToken(auth);

        if (!"DISPATCH".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }

        byte[] pdf =
                scannerDispatchService.dispatchBulkByScans(
                        request.getScanTexts(),
                        JwtUtil.getUsername(token)
                );

        return ResponseEntity.ok()
                .header(
                        "Content-Disposition",
                        preview
                                ? "inline; filename=qr-bulk-chalaan.pdf"
                                : "attachment; filename=qr-bulk-chalaan.pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private String extractToken(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }

        return auth.replace("Bearer ", "");
    }
}