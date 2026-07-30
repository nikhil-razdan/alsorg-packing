package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerResponse;
import com.alsorg.packing.service.matflow.MatFlowTrackerService;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowTrackerController {

    private final MatFlowTrackerService service;

    public MatFlowTrackerController(
            MatFlowTrackerService service) {

        this.service = service;
    }

    @GetMapping("/tracker")
    public TrackerResponse getTracker(
            @RequestParam(required = false) String search,

            @RequestParam(required = false) String plantCode,

            @RequestParam(required = false) String stage) {

        return service.getTracker(
                search,
                plantCode,
                stage);
    }
}