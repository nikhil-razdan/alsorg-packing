package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.dto.PackingVolumeRow;
import com.alsorg.packing.reporting.service.PackingReportService;
import com.alsorg.packing.reporting.service.PackingVolumeReportService;

@RestController
@RequestMapping("/api/reports/packing")
public class PackingReportController {

    private final PackingReportService service;
    private final PackingVolumeReportService volumeService;

    public PackingReportController(
            PackingReportService service,
            PackingVolumeReportService volumeService
    ) {
        this.service = service;
        this.volumeService = volumeService;
    }

    @GetMapping
    public List<PackingReportRow> getPackingReport(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        return service.getPackingReport(from, to);
    }

    /**
     * Packet-level packing volume feed.
     *
     * Example:
     * GET /api/reports/packing/volume?from=2026-08-01T00:00:00&to=2026-08-18T23:59:59
     *
     * This intentionally keeps the existing /api/reports/packing contract
     * unchanged so current frontend/report consumers remain backward-compatible.
     */
    @GetMapping("/volume")
    public List<PackingVolumeRow> getPackingVolumeReport(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        return volumeService.getPackingVolumeReport(from, to);
    }
}
