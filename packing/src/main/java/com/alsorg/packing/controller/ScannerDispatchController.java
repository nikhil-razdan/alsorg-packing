package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.scan.BulkScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanResolveResponse;
import com.alsorg.packing.security.JwtUtil;
import com.alsorg.packing.service.ScannerDispatchService;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/scanner")
public class ScannerDispatchController {

    private final ScannerDispatchService scannerDispatchService;
    private final CurrentUserService currentUserService;

    public ScannerDispatchController(
            ScannerDispatchService scannerDispatchService,
            CurrentUserService currentUserService
    ) {
        this.scannerDispatchService = scannerDispatchService;
        this.currentUserService = currentUserService;
    }

    /* ===================== RESOLVE QR ===================== */

    @PostMapping("/resolve")
    public ResponseEntity<ScanResolveResponse> resolve(
            @RequestBody ScanRequest request,
            @RequestHeader("Authorization") String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user) && !currentUserService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }

        return ResponseEntity.ok(
                scannerDispatchService.resolveScan(
                        request.getScanText(),
                        currentUserService.allowedPlants(user)
                )
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
    	User user = currentUserService.getCurrentUserFromAuth(auth);

    	if (!currentUserService.isDispatch(user)) {
    	    return ResponseEntity.status(403).build();
    	}

    	byte[] pdf =
    	        scannerDispatchService.dispatchSingleByScan(
    	                request.getScanText(),
    	                user.getUsername(),
    	                currentUserService.allowedPlants(user),
    	                request.getDriverId(),
    	                request.getVehicleId(),
    	                request.getTripStart()
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
    	User user = currentUserService.getCurrentUserFromAuth(auth);

    	if (!currentUserService.isDispatch(user)) {
    	    return ResponseEntity.status(403).build();
    	}

    	byte[] pdf =
    	        scannerDispatchService.dispatchBulkByScans(
    	                request.getScanTexts(),
    	                user.getUsername(),
    	                currentUserService.allowedPlants(user),
    	                request.getDriverId(),
    	                request.getVehicleId(),
    	                request.getTripStart()
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