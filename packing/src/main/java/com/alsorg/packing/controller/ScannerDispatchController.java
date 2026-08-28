package com.alsorg.packing.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.scan.BulkScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanResolveResponse;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.ScannerDispatchService;

@RestController
@RequestMapping("/api/scanner")
public class ScannerDispatchController {

    private final ScannerDispatchService scannerDispatchService;
    private final CurrentUserService currentUserService;

    public ScannerDispatchController(
            ScannerDispatchService scannerDispatchService,
            CurrentUserService currentUserService) {
        this.scannerDispatchService = scannerDispatchService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/resolve")
    public ResponseEntity<ScanResolveResponse> resolve(
            @RequestBody ScanRequest request) {

        User user = currentUserService.requireCurrentUser();
        requireDispatchAccess(user);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Scan request is required");
        }

        return ResponseEntity.ok(
                scannerDispatchService.resolveScan(
                        request.getScanText(),
                        currentUserService.allowedPlants(user)));
    }

    @PostMapping(
            value = "/dispatch-single",
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> dispatchSingle(
            @RequestBody ScanRequest request,
            @RequestParam(defaultValue = "true") boolean preview) {

        User user = currentUserService.requireCurrentUser();
        requireDispatchAccess(user);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Scan request is required");
        }

        DispatchTripPdfResult result = scannerDispatchService.dispatchSingleByScan(
                request.getScanText(),
                user.getUsername(),
                currentUserService.allowedPlants(user),
                request.getDriverId(),
                request.getVehicleId(),
                firstNonNull(
                        request.getDispatchTime(),
                        request.getTripStart()),
                request.getHelperLoaderCount());

        return buildPdfResponse(result, preview);
    }

    @PostMapping(
            value = "/dispatch-bulk",
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> dispatchBulk(
            @RequestBody BulkScanRequest request,
            @RequestParam(defaultValue = "true") boolean preview) {

        User user = currentUserService.requireCurrentUser();
        requireDispatchAccess(user);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bulk scan request is required");
        }

        DispatchTripPdfResult result = scannerDispatchService.dispatchBulkByScans(
                request.getScanTexts(),
                user.getUsername(),
                currentUserService.allowedPlants(user),
                request.getDriverId(),
                request.getVehicleId(),
                firstNonNull(
                        request.getDispatchTime(),
                        request.getTripStart()),
                request.getHelperLoaderCount());

        return buildPdfResponse(result, preview);
    }

    private void requireDispatchAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "DISPATCH")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN or DISPATCH can use scanner dispatch");
        }
    }

    private ResponseEntity<byte[]> buildPdfResponse(
            DispatchTripPdfResult result,
            boolean preview) {

        if (result == null || result.getPdfBytes() == null || result.getPdfBytes().length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Challan PDF could not be generated");
        }

        String challanNo = result.getChallanNumber() == null
                || result.getChallanNumber().isBlank()
                        ? "challan"
                        : result.getChallanNumber().trim();

        String filename = challanNo.replaceAll("[^a-zA-Z0-9._-]", "_") + ".pdf";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        (preview ? "inline" : "attachment")
                                + "; filename=\"" + filename + "\"")
                .header("X-Challan-No", challanNo)
                .header(
                        "Access-Control-Expose-Headers",
                        "X-Challan-No, Content-Disposition")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(MediaType.APPLICATION_PDF)
                .body(result.getPdfBytes());
    }

    private java.time.LocalDateTime firstNonNull(
            java.time.LocalDateTime first,
            java.time.LocalDateTime second) {
        return first != null ? first : second;
    }
}
