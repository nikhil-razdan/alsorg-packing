package com.alsorg.packing.reporting.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.DashboardActivityRow;
import com.alsorg.packing.reporting.service.DashboardActivityService;

@RestController
@RequestMapping("/api/reports/dashboard/activity")
public class DashboardActivityController {

    private final DashboardActivityService service;

    public DashboardActivityController(
            DashboardActivityService service
    ) {
        this.service = service;
    }

    @GetMapping
    public List<DashboardActivityRow> getActivity(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int offset
    ) {
        return service.getRecentActivity(limit, offset);
    }
}
