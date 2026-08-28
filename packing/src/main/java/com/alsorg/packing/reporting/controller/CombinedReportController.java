package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.reporting.dto.CombinedReportRow;
import com.alsorg.packing.reporting.service.CombinedReportService;

@RestController
@RequestMapping("/api/reports/combined")
@PreAuthorize("isAuthenticated()")
public class CombinedReportController {

    private final CombinedReportService service;

    public CombinedReportController(
            CombinedReportService service) {
        this.service = service;
    }

    @GetMapping
    public List<CombinedReportRow> getCombinedReport(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        return service.getCombinedReport(from, to);
    }
}
