package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.VenFlowPoVerificationDtos.PoVerificationResponse;
import com.alsorg.packing.service.VenFlowPoVerificationService;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/venflow")
public class VenFlowPoVerificationController {

    private final VenFlowPoVerificationService service;

    public VenFlowPoVerificationController(
            VenFlowPoVerificationService service) {

        this.service = service;
    }

    @GetMapping(
            "/entries/{entryId}/po-verifications")
    public List<PoVerificationResponse> list(
            @PathVariable UUID entryId) {

        return service.list(
                entryId);
    }

    @GetMapping(
            "/entries/{entryId}/po-verifications/"
                    + "{verificationId}")
    public PoVerificationResponse get(
            @PathVariable UUID entryId,
            @PathVariable UUID verificationId) {

        return service.get(
                entryId,
                verificationId);
    }
}