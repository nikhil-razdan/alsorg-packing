package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.logistics.DispatchTripRequest;
import com.alsorg.packing.controller.dto.logistics.LogisticsTripItemResponse;
import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.LogisticsDispatchTripService;

@RestController
@RequestMapping("/api/logistics")
public class LogisticsDispatchController {

    private final LogisticsDispatchTripService tripService;
    private final CurrentUserService currentUserService;

    public LogisticsDispatchController(
            LogisticsDispatchTripService tripService,
            CurrentUserService currentUserService) {
        this.tripService = tripService;
        this.currentUserService = currentUserService;
    }

    @PostMapping(
            value = "/dispatch/chalaan",
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> createDispatchTripAndChallan(
            @RequestBody DispatchTripRequest request,
            @RequestParam(defaultValue = "true") boolean preview) {

        User user = currentUserService.requireCurrentUser();
        requireDispatchCreateAccess(user);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Dispatch request is required");
        }

        DispatchTripPdfResult result = tripService.createTripAndGenerateChallan(
                request.getItemIds(),
                request.getDriverId(),
                request.getVehicleId(),
                request.getTripStart(),
                user.getUsername(),
                "UI_DISPATCH");

        return pdfResponse(result, preview, true);
    }

    @GetMapping("/trips")
    public List<LogisticsTrip> getTrips() {
        User user = currentUserService.requireCurrentUser();
        requireViewAccess(user);
        return tripService.getTripsForUser(user);
    }

    @GetMapping("/trips/{tripId}/items")
    public List<LogisticsTripItemResponse> getTripItems(
            @PathVariable UUID tripId) {
        User user = currentUserService.requireCurrentUser();
        requireViewAccess(user);
        return tripService.getTripItemsForUser(tripId, user);
    }

    @PostMapping("/trips/{tripId}/start")
    public ResponseEntity<Map<String, String>> startTripDisabled(
            @PathVariable UUID tripId) {
        currentUserService.requireCurrentUser();
        return ResponseEntity
                .status(HttpStatus.GONE)
                .body(Map.of(
                        "message",
                        "Start trip flow has been removed. Dispatch challan is final."));
    }

    @PostMapping("/trips/{tripId}/location")
    public ResponseEntity<Map<String, String>> updateTripLocationDisabled(
            @PathVariable UUID tripId) {
        currentUserService.requireCurrentUser();
        return ResponseEntity
                .status(HttpStatus.GONE)
                .body(Map.of(
                        "message",
                        "Live location tracking has been removed."));
    }

    @PostMapping("/trips/{tripId}/end")
    public ResponseEntity<Map<String, String>> endTripDisabled(
            @PathVariable UUID tripId) {
        currentUserService.requireCurrentUser();
        return ResponseEntity
                .status(HttpStatus.GONE)
                .body(Map.of(
                        "message",
                        "Delivery/POD completion flow has been removed."));
    }

    @GetMapping(
            value = "/trips/{tripId}/challan",
            produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadTripChallan(
            @PathVariable UUID tripId) {

        User user = currentUserService.requireCurrentUser();
        requireViewAccess(user);

        DispatchTripPdfResult result = tripService.generateChallanPdfForTrip(
                tripId,
                user);

        return pdfResponse(result, false, true);
    }

    private ResponseEntity<byte[]> pdfResponse(
            DispatchTripPdfResult result,
            boolean inline,
            boolean exposeTripId) {

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

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        (inline ? "inline" : "attachment")
                                + "; filename=\"" + filename + "\"")
                .header("X-Challan-No", challanNo)
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(MediaType.APPLICATION_PDF);

        if (exposeTripId && result.getTripId() != null) {
            builder.header("X-Trip-Id", result.getTripId().toString());
            builder.header(
                    "Access-Control-Expose-Headers",
                    "X-Trip-Id, X-Challan-No, Content-Disposition");
        } else {
            builder.header(
                    "Access-Control-Expose-Headers",
                    "X-Challan-No, Content-Disposition");
        }

        return builder.body(result.getPdfBytes());
    }

    private void requireDispatchCreateAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "DISPATCH")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN or DISPATCH can create dispatch challans");
        }
    }

    private void requireViewAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to view dispatched challans");
        }
    }
}
