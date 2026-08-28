package com.alsorg.packing.reporting.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.reporting.dto.DashboardActivityRow;
import com.alsorg.packing.reporting.service.DashboardActivityService;

@RestController
@RequestMapping("/api/reports/dashboard/activity")
@PreAuthorize("hasAuthority('ADMIN')")
public class DashboardActivityController {

    private final DashboardActivityService service;

    public DashboardActivityController(
            DashboardActivityService service) {
        this.service = service;
    }

    @GetMapping
    public List<DashboardActivityRow> getActivity(
            @RequestParam(defaultValue = "12") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        int safeOffset = Math.max(offset, 0);

        return service.getRecentActivity(
                safeLimit,
                safeOffset);
    }
}
