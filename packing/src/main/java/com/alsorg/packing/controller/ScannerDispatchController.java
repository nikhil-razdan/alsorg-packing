package com.alsorg.packing.controller;

import java.util.List;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.scan.BulkScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanRequest;
import com.alsorg.packing.controller.dto.scan.ScanResolveResponse;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.ScannerDispatchService;
import com.alsorg.packing.service.UtlWorkflowService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * QR / barcode dispatch controller.
 *
 * Normal DISPATCH behavior is preserved. UTL_DISPATCH is accepted only as the
 * constrained Dispatch subtype exposed by CurrentUserService.hasAnyRole().
 * For a UTL identity, every resolved scan is additionally matched back to the
 * DispatchedItem and checked through UtlWorkflowService before any DTO is
 * returned or any challan mutation begins. Therefore sharing the same physical
 * AL-P3/WR-38 plant never grants scan access to unrelated normal or other-UTL
 * packets.
 */
@RestController
@RequestMapping("/api/scanner")
public class ScannerDispatchController {

    private final ScannerDispatchService scannerDispatchService;
    private final CurrentUserService currentUserService;

    /*
     * Optional field injection keeps the long-standing constructor source
     * compatible for tests/tools. Production has both beans in the UTL-enabled
     * backend. A UTL request fails closed if either dependency is unavailable.
     */
    @Autowired(required = false)
    private UtlWorkflowService utlWorkflowService;

    @Autowired(required = false)
    private DispatchedItemRepository dispatchedItemRepository;

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

        if (!currentUserService.isAdmin(user)
                && !currentUserService.hasAnyRole(user, "DISPATCH")) {
            return ResponseEntity.status(403).build();
        }

        ScanResolveResponse resolved = scannerDispatchService.resolveScan(
                request.getScanText(),
                currentUserService.allowedPlants(user));

        assertUtlResolvedScanAccess(user, resolved);

        return ResponseEntity.ok(resolved);
    }

    @PostMapping(
            value = "/dispatch-single",
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> dispatchSingle(
            @RequestBody ScanRequest request,
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(defaultValue = "true") boolean preview) {

        User user = currentUserService.getCurrentUserFromAuth(auth);

        /* Preserve the existing non-admin scanner-dispatch rule. */
        if (!currentUserService.hasAnyRole(user, "DISPATCH")) {
            return ResponseEntity.status(403).build();
        }

        if (currentUserService.isUtlDispatch(user)) {
            ScanResolveResponse resolved = scannerDispatchService.resolveScan(
                    request.getScanText(),
                    currentUserService.allowedPlants(user));
            assertUtlResolvedScanAccess(user, resolved);
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

    @PostMapping(
            value = "/dispatch-bulk",
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> dispatchBulk(
            @RequestBody BulkScanRequest request,
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(defaultValue = "true") boolean preview) {

        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.hasAnyRole(user, "DISPATCH")) {
            return ResponseEntity.status(403).build();
        }

        if (currentUserService.isUtlDispatch(user)) {
            List<String> scans = request == null
                    ? null
                    : request.getScanTexts();

            if (scans == null || scans.isEmpty()) {
                throw new IllegalArgumentException(
                        "No QR / sticker scans provided");
            }

            for (String scan : scans) {
                ScanResolveResponse resolved = scannerDispatchService.resolveScan(
                        scan,
                        currentUserService.allowedPlants(user));
                assertUtlResolvedScanAccess(user, resolved);
            }
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

    private void assertUtlResolvedScanAccess(
            User user,
            ScanResolveResponse resolved) {

        if (!currentUserService.isUtlDispatch(user)) {
            return;
        }

        if (utlWorkflowService == null
                || dispatchedItemRepository == null) {
            throw new AccessDeniedException(
                    "UTL scan authorization is unavailable");
        }

        String itemId = resolved == null
                ? null
                : clean(resolved.getZohoItemId());

        if (itemId == null) {
            throw new AccessDeniedException(
                    "Scanned UTL item could not be resolved");
        }

        DispatchedItem item = dispatchedItemRepository
                .findById(itemId)
                .orElseThrow(() -> new AccessDeniedException(
                        "Scanned item is not available to this UTL user"));

        utlWorkflowService.assertCurrentUserCanOperate(item);
    }

    private ResponseEntity<byte[]> buildPdfResponse(
            DispatchTripPdfResult result,
            boolean preview) {

        String challanNo = result.getChallanNumber() == null
                || result.getChallanNumber().isBlank()
                        ? "challan"
                        : result.getChallanNumber();

        String filename = challanNo
                .replaceAll("[^a-zA-Z0-9._-]", "_")
                + ".pdf";

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
        return first != null
                ? first
                : second;
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();
        return clean.isBlank()
                ? null
                : clean;
    }
}
