package com.alsorg.packing.controller;

import java.util.List;
import com.alsorg.packing.controller.dto.logistics.UpdateShiftStatusRequest;
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
    
    @PutMapping("/{id}")
    public LogisticsShift updateShift(
            @PathVariable UUID id,
            @RequestBody CreateShiftRequest request
    ) {
        return service.updateShift(
                id,
                request
        );
    }

    @PatchMapping("/{id}/status")
    public LogisticsShift updateShiftStatus(
            @PathVariable UUID id,
            @RequestBody UpdateShiftStatusRequest request
    ) {
        return service.updateShiftStatus(
                id,
                request
        );
    }
    
    @DeleteMapping("/{id}")
    public void deleteShift(
            @PathVariable UUID id
    ) {
        service.deleteShift(id);
    }
}