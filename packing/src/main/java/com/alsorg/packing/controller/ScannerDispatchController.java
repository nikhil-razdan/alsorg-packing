package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.scan.BulkScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanResolveResponse;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.ScannerDispatchService;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
                        @RequestBody ScanRequest request,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isDispatch(user)
                                && !currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403).build();
                }

                return ResponseEntity.ok(
                                scannerDispatchService.resolveScan(
                                                request.getScanText(),
                                                currentUserService.allowedPlants(user)));
        }

        @PostMapping(value = "/dispatch-single", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> dispatchSingle(
                        @RequestBody ScanRequest request,
                        @RequestHeader(value = "Authorization", required = false) String auth,
                        @RequestParam(defaultValue = "true") boolean preview) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isDispatch(user)) {
                        return ResponseEntity.status(403).build();
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

                return buildPdfResponse(
                                result,
                                preview);
        }

        @PostMapping(value = "/dispatch-bulk", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> dispatchBulk(
                        @RequestBody BulkScanRequest request,
                        @RequestHeader(value = "Authorization", required = false) String auth,
                        @RequestParam(defaultValue = "true") boolean preview) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isDispatch(user)) {
                        return ResponseEntity.status(403).build();
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

                return buildPdfResponse(
                                result,
                                preview);
        }

        private ResponseEntity<byte[]> buildPdfResponse(
                        DispatchTripPdfResult result,
                        boolean preview) {
                String challanNo = result.getChallanNumber() == null || result.getChallanNumber().isBlank()
                                ? "challan"
                                : result.getChallanNumber();

                String filename = challanNo.replaceAll("[^a-zA-Z0-9._-]", "_") + ".pdf";

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                preview
                                                                ? "inline; filename=" + filename
                                                                : "attachment; filename=" + filename)
                                .header(
                                                "X-Challan-No",
                                                challanNo)
                                .header(
                                                "Access-Control-Expose-Headers",
                                                "X-Challan-No, Content-Disposition")
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(result.getPdfBytes());
        }

        private java.time.LocalDateTime firstNonNull(
                        java.time.LocalDateTime first,
                        java.time.LocalDateTime second) {
                return first != null ? first : second;
        }

}