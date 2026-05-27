package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

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
    
    @GetMapping
    public List<LogisticsShift> getAll() {

        return service.getAllShifts();
    }
    
    @DeleteMapping("/{id}")
    public void deleteShift(
            @PathVariable UUID id
    ) {
        service.deleteShift(id);
    }
}