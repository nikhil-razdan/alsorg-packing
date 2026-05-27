package com.alsorg.packing.controller;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.logistics.LogisticsShift;
import com.alsorg.packing.controller.dto.logistics.CreateShiftRequest;
import com.alsorg.packing.service.LogisticsShiftService;

@RestController
@RequestMapping("/api/logistics/shifts")
@CrossOrigin("*")
public class LogisticsShiftController {

    private final LogisticsShiftService service;

    public LogisticsShiftController(
            LogisticsShiftService service
    ) {
        this.service = service;
    }

    @PostMapping
    public LogisticsShift createShift(
            @RequestBody CreateShiftRequest request
    ) {
        return service.createShift(request);
    }
}