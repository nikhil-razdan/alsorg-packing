package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.controller.dto.logistics.DispatchTripRequest;
import com.alsorg.packing.controller.dto.logistics.EndTripRequest;
import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.LogisticsDispatchTripService;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

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

    @PostMapping(
            value = "/dispatch/chalaan",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> createDispatchTripAndChallan(
            @RequestBody DispatchTripRequest request,
            @RequestHeader("Authorization") String auth,
            @RequestParam(defaultValue = "true") boolean preview
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
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
                                ? "inline; filename=CHALAAN_" + result.getChallanNumber() + ".pdf"
                                : "attachment; filename=CHALAAN_" + result.getChallanNumber() + ".pdf"
                )
                .header("X-Trip-Id", result.getTripId().toString())
                .header("X-Challan-No", result.getChallanNumber())
                .contentType(MediaType.APPLICATION_PDF)
                .body(result.getPdfBytes());
    }

    @GetMapping("/trips")
    public List<LogisticsTrip> getAllTrips(
            @RequestHeader("Authorization") String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user) && !currentUserService.isAdmin(user)) {
            throw new RuntimeException("Access denied");
        }

        return tripService.getAllTrips();
    }

    @PostMapping("/trips/{tripId}/end")
    public LogisticsTrip endTrip(
            @PathVariable UUID tripId,
            @RequestBody EndTripRequest request,
            @RequestHeader("Authorization") String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user) && !currentUserService.isAdmin(user)) {
            throw new RuntimeException("Access denied");
        }

        return tripService.endTrip(
                tripId,
                request.getTripEnd(),
                user.getUsername(),
                request.getRemarks()
        );
    }
}