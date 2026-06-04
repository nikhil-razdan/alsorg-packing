package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.CombinedReportRow;
import com.alsorg.packing.reporting.service.CombinedReportService;

@RestController
@RequestMapping("/api/reports/combined")
public class CombinedReportController {

    private final CombinedReportService service;

    public CombinedReportController(
            CombinedReportService service
    ) {
        this.service = service;
    }

    @GetMapping
    public List<CombinedReportRow> getCombinedReport(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        return service.getCombinedReport(
                from,
                to
        );
    }
}