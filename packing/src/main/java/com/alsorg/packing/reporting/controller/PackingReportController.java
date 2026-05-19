package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.service.PackingReportService;

@RestController
@RequestMapping("/api/reports/packing")
public class PackingReportController {

    private final PackingReportService service;

    public PackingReportController(PackingReportService service) {
        this.service = service;
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
}
