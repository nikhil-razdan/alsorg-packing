package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.dto.PackingVolumeRow;
import com.alsorg.packing.reporting.service.PackingReportService;
import com.alsorg.packing.reporting.service.PackingVolumeReportService;

@RestController
@RequestMapping("/api/reports/packing")
@PreAuthorize("isAuthenticated()")
public class PackingReportController {

    private final PackingReportService service;
    private final PackingVolumeReportService volumeService;

    public PackingReportController(
            PackingReportService service,
            PackingVolumeReportService volumeService) {
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
            LocalDateTime to) {
        return service.getPackingReport(from, to);
    }

    @GetMapping("/volume")
    public List<PackingVolumeRow> getPackingVolumeReport(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        return volumeService.getPackingVolumeReport(from, to);
    }
}
