package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.service.DispatchReportService;

@RestController
@RequestMapping("/api/reports/dispatch")
@PreAuthorize("isAuthenticated()")
public class DispatchReportController {

    private final DispatchReportService service;

    public DispatchReportController(DispatchReportService service) {
        this.service = service;
    }

    @GetMapping
    public List<DispatchReportRow> getDispatchReport(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        return service.getDispatchReport(from, to);
    }
}
