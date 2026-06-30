package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.logistics.DispatchTripRequest;
import com.alsorg.packing.controller.dto.logistics.LogisticsTripItemResponse;
import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.LogisticsDispatchTripService;

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
                        CurrentUserService currentUserService
        ) {
                this.tripService = tripService;
                this.currentUserService = currentUserService;
        }

        /*
         * DISPATCH / ADMIN:
         * Scan/select items, choose driver + vehicle, generate challan,
         * and mark items DISPATCHED immediately.
         */
        @PostMapping(
                        value = "/dispatch/chalaan",
                        produces = MediaType.APPLICATION_PDF_VALUE
        )
        public ResponseEntity<byte[]> createDispatchTripAndChallan(
                        @RequestBody DispatchTripRequest request,
                        @RequestHeader(value = "Authorization", required = false) String auth,
                        @RequestParam(defaultValue = "true") boolean preview
        ) {
                User user =
                                currentUserService.getCurrentUserFromAuth(auth);

                if (
                                !currentUserService.isDispatch(user) &&
                                !currentUserService.isAdmin(user)
                ) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }

                DispatchTripPdfResult result =
                                tripService.createTripAndGenerateChallan(
                                                request.getItemIds(),
                                                request.getDriverId(),
                                                request.getVehicleId(),
                                                request.getTripStart(),
                                                user.getUsername(),
                                                "UI_DISPATCH"
                                );

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                preview
                                                                ? "inline; filename=" + result.getChallanNumber() + ".pdf"
                                                                : "attachment; filename=" + result.getChallanNumber() + ".pdf"
                                )
                                .header("X-Trip-Id", result.getTripId().toString())
                                .header("X-Challan-No", result.getChallanNumber())
                                .header(
                                                "Access-Control-Expose-Headers",
                                                "X-Trip-Id, X-Challan-No, Content-Disposition"
                                )
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(result.getPdfBytes());
        }

        /*
         * ADMIN / DISPATCH / LOGISTICS:
         * View dispatched challans.
         */
        @GetMapping("/trips")
        public List<LogisticsTrip> getTrips(
                        @RequestHeader(value = "Authorization", required = false) String auth
        ) {
                User user =
                                currentUserService.getCurrentUserFromAuth(auth);

                if (!canViewDispatchChallans(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You do not have permission to view dispatched challans"
                        );
                }

                return tripService.getTripsForUser(user);
        }

        /*
         * ADMIN / DISPATCH / LOGISTICS:
         * View challan items.
         */
        @GetMapping("/trips/{tripId}/items")
        public List<LogisticsTripItemResponse> getTripItems(
                        @PathVariable UUID tripId,
                        @RequestHeader(value = "Authorization", required = false) String auth
        ) {
                User user =
                                currentUserService.getCurrentUserFromAuth(auth);

                if (!canViewDispatchChallans(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You do not have permission to view dispatch items"
                        );
                }

                return tripService.getTripItemsForUser(
                                tripId,
                                user
                );
        }

        /*
         * Disabled:
         * Driver start trip removed.
         */
        @PostMapping("/trips/{tripId}/start")
        public ResponseEntity<Map<String, String>> startTripDisabled(
                        @PathVariable UUID tripId
        ) {
                return ResponseEntity
                                .status(HttpStatus.GONE)
                                .body(Map.of(
                                                "message",
                                                "Start trip flow has been removed. Dispatch challan is final."
                                ));
        }

        /*
         * Disabled:
         * Live location removed.
         */
        @PostMapping("/trips/{tripId}/location")
        public ResponseEntity<Map<String, String>> updateTripLocationDisabled(
                        @PathVariable UUID tripId
        ) {
                return ResponseEntity
                                .status(HttpStatus.GONE)
                                .body(Map.of(
                                                "message",
                                                "Live location tracking has been removed."
                                ));
        }

        /*
         * Disabled:
         * Delivery/POD end trip removed.
         */
        @PostMapping("/trips/{tripId}/end")
        public ResponseEntity<Map<String, String>> endTripDisabled(
                        @PathVariable UUID tripId
        ) {
                return ResponseEntity
                                .status(HttpStatus.GONE)
                                .body(Map.of(
                                                "message",
                                                "Delivery/POD completion flow has been removed."
                                ));
        }

        /*
         * ADMIN / DISPATCH / LOGISTICS:
         * Download generated challan.
         *
         * Works with both:
         * Web    -> HttpOnly cookie
         * Mobile -> Authorization Bearer token
         */
        @GetMapping(
                        value = "/trips/{tripId}/challan",
                        produces = MediaType.APPLICATION_PDF_VALUE
        )
        public ResponseEntity<byte[]> downloadTripChallan(
                        @PathVariable UUID tripId,
                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth
        ) {
                User user =
                                currentUserService.getCurrentUserFromAuth(auth);

                if (!canViewDispatchChallans(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You do not have permission to download this challan"
                        );
                }

                DispatchTripPdfResult result =
                                tripService.generateChallanPdfForTrip(
                                                tripId,
                                                user
                                );

                String challanNo =
                                result.getChallanNumber();

                String filename =
                                challanNo == null || challanNo.isBlank()
                                                ? "challan.pdf"
                                                : challanNo + ".pdf";

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=" + filename
                                )
                                .header("X-Trip-Id", result.getTripId().toString())
                                .header("X-Challan-No", challanNo)
                                .header(
                                                "Access-Control-Expose-Headers",
                                                "X-Trip-Id, X-Challan-No, Content-Disposition"
                                )
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(result.getPdfBytes());
        }

        private boolean canViewDispatchChallans(
                        User user
        ) {
                return currentUserService.isAdmin(user)
                                || currentUserService.isDispatch(user)
                                || currentUserService.isLogistics(user);
        }
}