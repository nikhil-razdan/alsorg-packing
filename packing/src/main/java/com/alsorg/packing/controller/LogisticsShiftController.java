package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.logistics.LogisticsShift;
import com.alsorg.packing.service.LogisticsShiftService;

@RestController
@RequestMapping("/api/logistics/shifts")
public class LogisticsShiftController {

    private final LogisticsShiftService service;

    public LogisticsShiftController(
            LogisticsShiftService service
    ) {
        this.service = service;
    }

    /*
     * CREATE SHIFT
     */

    @PostMapping
    public LogisticsShift create(
            @RequestBody LogisticsShift shift
    ) {
        return service.createShift(shift);
    }

    /*
     * GET ALL
     */

    @GetMapping
    public List<LogisticsShift> getAll() {
        return service.getAll();
    }
}