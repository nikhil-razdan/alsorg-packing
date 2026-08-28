package com.alsorg.packing.reporting.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.reporting.dto.InventoryAgingRow;
import com.alsorg.packing.reporting.service.InventoryAgingReportService;

@RestController
@RequestMapping("/api/reports/inventory-aging")
@PreAuthorize("isAuthenticated()")
public class InventoryAgingReportController {

    private final InventoryAgingReportService service;

    public InventoryAgingReportController(
            InventoryAgingReportService service) {
        this.service = service;
    }

    @GetMapping
    public List<InventoryAgingRow> getInventoryAging() {
        return service.getInventoryAgingReport();
    }
}
