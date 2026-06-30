package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DispatchChallanService;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chalaan")
public class ChalaanPdfController {

    private final DispatchChallanService dispatchChallanService;
    private final CurrentUserService currentUserService;

    public ChalaanPdfController(
            DispatchChallanService dispatchChallanService,
            CurrentUserService currentUserService
    ) {
        this.dispatchChallanService = dispatchChallanService;
        this.currentUserService = currentUserService;
    }

    @Transactional
    @PostMapping(
            value = "/dispatch",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> generateDispatchChallan(
            @RequestBody ChallanDispatchRequest request,
            @RequestParam(defaultValue = "true") boolean preview,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        DispatchTripPdfResult result =
                dispatchChallanService.generateAndDispatch(
                        request.itemIds(),
                        request.driverId(),
                        request.vehicleId(),
                        user.getUsername(),
                        currentUserService.allowedPlants(user)
                );

        return buildPdfResponse(
                result,
                preview
        );
    }

    @Transactional
    @GetMapping(
            value = "/{zohoItemId}/download",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> generateSingle(
            @PathVariable String zohoItemId,
            @RequestParam UUID driverId,
            @RequestParam UUID vehicleId,
            @RequestParam(defaultValue = "false") boolean preview,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        DispatchTripPdfResult result =
                dispatchChallanService.generateAndDispatch(
                        List.of(zohoItemId),
                        driverId,
                        vehicleId,
                        user.getUsername(),
                        currentUserService.allowedPlants(user)
                );

        return buildPdfResponse(
                result,
                preview
        );
    }

    @Transactional
    @PostMapping(
            value = "/bulk",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    public ResponseEntity<byte[]> generateBulk(
            @RequestBody List<String> ids,
            @RequestParam UUID driverId,
            @RequestParam UUID vehicleId,
            @RequestParam(defaultValue = "false") boolean preview,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isDispatch(user)) {
            return ResponseEntity.status(403).build();
        }

        DispatchTripPdfResult result =
                dispatchChallanService.generateAndDispatch(
                        ids,
                        driverId,
                        vehicleId,
                        user.getUsername(),
                        currentUserService.allowedPlants(user)
                );

        return buildPdfResponse(
                result,
                preview
        );
    }

    private ResponseEntity<byte[]> buildPdfResponse(
            DispatchTripPdfResult result,
            boolean preview
    ) {
        String challanNo =
                result.getChallanNumber() == null || result.getChallanNumber().isBlank()
                        ? "challan"
                        : result.getChallanNumber();

        String filename =
                challanNo.replaceAll("[^a-zA-Z0-9._-]", "_") + ".pdf";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        preview
                                ? "inline; filename=" + filename
                                : "attachment; filename=" + filename
                )
                .header(
                        "X-Challan-No",
                        challanNo
                )
                .header(
                        "Access-Control-Expose-Headers",
                        "X-Challan-No, Content-Disposition"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(result.getPdfBytes());
    }

    public record ChallanDispatchRequest(
            List<String> itemIds,
            UUID driverId,
            UUID vehicleId,

            /*
             * Kept only so old frontend/mobile payload does not break.
             * Not used for trip/delivery anymore.
             */
            LocalDateTime tripStart,
            LocalDateTime dispatchTime
    ) {
    }
}