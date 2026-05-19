package com.alsorg.packing.reporting.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.InventoryAgingRow;
import com.alsorg.packing.reporting.service.InventoryAgingReportService;

@RestController
@RequestMapping("/api/reports/inventory-aging")
public class InventoryAgingReportController {

    private final InventoryAgingReportService service;

    public InventoryAgingReportController(InventoryAgingReportService service) {
        this.service = service;
    }

    @GetMapping
    public List<InventoryAgingRow> getInventoryAging() {
        return service.getInventoryAgingReport();
    }
}
