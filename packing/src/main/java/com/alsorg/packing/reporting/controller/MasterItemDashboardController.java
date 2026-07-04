package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.MasterItemDetailResponse;
import com.alsorg.packing.reporting.dto.MasterItemPageResponse;
import com.alsorg.packing.reporting.service.MasterItemDashboardService;

@RestController
@RequestMapping("/api/reports/dashboard/master-items")
public class MasterItemDashboardController {

    private final MasterItemDashboardService service;

    public MasterItemDashboardController(
            MasterItemDashboardService service
    ) {
        this.service = service;
    }

    @GetMapping
    public MasterItemPageResponse getMasterItems(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String packingStatus,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String clientName,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to,

            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return service.getMasterItems(
                search,
                packingStatus,
                plantCode,
                clientName,
                from,
                to,
                page,
                size
        );
    }

    @GetMapping("/{masterItemId}")
    public MasterItemDetailResponse getMasterItemDetail(
            @PathVariable UUID masterItemId
    ) {
        return service.getMasterItemDetail(
                masterItemId
        );
    }
}