package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.logistics.DispatchTripRequest;
import com.alsorg.packing.controller.dto.logistics.EndTripRequest;
import com.alsorg.packing.controller.dto.logistics.LogisticsTripItemResponse;
import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.LogisticsDispatchTripService;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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

        /*
         * DISPATCH only:
         * Create/load trip into queue and generate challan.
         * This does NOT start the trip.
         */
        @PostMapping(value = "/dispatch/chalaan", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> createDispatchTripAndChallan(
                        @RequestBody DispatchTripRequest request,
                        @RequestHeader("Authorization") String auth,
                        @RequestParam(defaultValue = "true") boolean preview) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isDispatch(user)) {
                        return ResponseEntity.status(403).build();
                }

                DispatchTripPdfResult result = tripService.createTripAndGenerateChallan(
                                request.getItemIds(),
                                request.getDriverId(),
                                request.getVehicleId(),
                                request.getTripStart(),
                                user.getUsername(),
                                "UI_DISPATCH");

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                preview
                                                                ? "inline; filename=" + result.getChallanNumber()
                                                                                + ".pdf"
                                                                : "attachment; filename=" + result.getChallanNumber()
                                                                                + ".pdf")
                                .header("X-Trip-Id", result.getTripId().toString())
                                .header("X-Challan-No", result.getChallanNumber())
                                .header(
                                                "Access-Control-Expose-Headers",
                                                "X-Trip-Id, X-Challan-No, Content-Disposition")
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(result.getPdfBytes());
        }

        /*
         * ADMIN / DISPATCH / LOGISTICS:
         * See all trips.
         *
         * DRIVER:
         * See only own assigned trips.
         */
        @GetMapping("/trips")
        public List<LogisticsTrip> getTrips(
                        @RequestHeader("Authorization") String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.canViewTrips(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You do not have permission to view trips");
                }

                return tripService.getTripsForUser(user);
        }

        /*
         * Trip items:
         * ADMIN / DISPATCH / LOGISTICS can view any trip.
         * DRIVER can view only his/her own assigned trip.
         */
        @GetMapping("/trips/{tripId}/items")
        public List<LogisticsTripItemResponse> getTripItems(
                        @PathVariable UUID tripId,
                        @RequestHeader("Authorization") String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.canViewTrips(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You do not have permission to view trip items");
                }

                return tripService.getTripItemsForUser(
                                tripId,
                                user);
        }

        /*
         * DRIVER only:
         * Driver starts queued trip.
         */
        @PostMapping("/trips/{tripId}/start")
        public LogisticsTrip startTrip(
                        @PathVariable UUID tripId,
                        @RequestHeader("Authorization") String auth,
                        @RequestBody(required = false) Map<String, Object> body) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                LocalDateTime requestedStart = null;

                if (body != null && body.get("tripStart") != null) {
                        String text = String.valueOf(body.get("tripStart")).trim();

                        if (!text.isBlank()) {
                                requestedStart = LocalDateTime.parse(text);
                        }
                }

                return tripService.startTrip(
                                tripId,
                                user,
                                requestedStart);
        }

        /*
         * DRIVER only:
         * Driver live location ping while trip is active.
         */
        @PostMapping("/trips/{tripId}/location")
        public LogisticsTrip updateTripLocation(
                        @PathVariable UUID tripId,
                        @RequestHeader("Authorization") String auth,
                        @RequestBody Map<String, Object> body) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                Double latitude = readDouble(body.get("latitude"));
                Double longitude = readDouble(body.get("longitude"));
                Double accuracy = readDouble(body.get("accuracy"));

                return tripService.updateTripLocation(
                                tripId,
                                user,
                                latitude,
                                longitude,
                                accuracy);
        }

        /*
         * DRIVER only:
         * Driver ends active trip.
         */
        @PostMapping("/trips/{tripId}/end")
        public LogisticsTrip endTrip(
                        @PathVariable UUID tripId,
                        @RequestBody EndTripRequest request,
                        @RequestHeader("Authorization") String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                return tripService.endTrip(
                                tripId,
                                request.getTripEnd(),
                                user,
                                request.getRemarks(),
                                request.getReceiverName(),
                                request.getReceiverPhone(),
                                request.getPodUrl(),
                                request.getDeliveryRemarks(),
                                request.getDeliveryLatitude(),
                                request.getDeliveryLongitude(),
                                request.getDeliveryLocationAccuracy());
        }

        /*
         * ADMIN / DISPATCH / LOGISTICS / DRIVER:
         * Download challan.
         * DRIVER can download only own assigned trip.
         */
        @GetMapping(value = "/trips/{tripId}/challan", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> downloadTripChallan(
                        @PathVariable UUID tripId,
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
                if (auth == null || !auth.startsWith("Bearer ")) {
                        return ResponseEntity
                                        .status(HttpStatus.UNAUTHORIZED)
                                        .contentType(MediaType.TEXT_PLAIN)
                                        .body(
                                                        "Missing Authorization header for challan download"
                                                                        .getBytes(StandardCharsets.UTF_8));
                }

                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.canViewTrips(user)) {
                        return ResponseEntity
                                        .status(HttpStatus.FORBIDDEN)
                                        .contentType(MediaType.TEXT_PLAIN)
                                        .body(
                                                        "You do not have permission to download this challan"
                                                                        .getBytes(StandardCharsets.UTF_8));
                }

                DispatchTripPdfResult result = tripService.generateChallanPdfForTrip(
                                tripId,
                                user);

                String challanNo = result.getChallanNumber();

                String filename = challanNo == null || challanNo.isBlank()
                                ? "challan.pdf"
                                : challanNo + ".pdf";

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=" + filename)
                                .header("X-Trip-Id", result.getTripId().toString())
                                .header("X-Challan-No", challanNo)
                                .header(
                                                "Access-Control-Expose-Headers",
                                                "X-Trip-Id, X-Challan-No, Content-Disposition")
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(result.getPdfBytes());
        }

        private Double readDouble(Object value) {
                if (value == null) {
                        return null;
                }

                String text = String.valueOf(value).trim();

                if (text.isBlank() || "null".equalsIgnoreCase(text)) {
                        return null;
                }

                return Double.valueOf(text);
        }
}