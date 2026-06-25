package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.controller.dto.logistics.VehicleExpenseRequest;
import com.alsorg.packing.domain.logistics.VehicleExpense;
import com.alsorg.packing.service.VehicleExpenseService;

@RestController
@RequestMapping("/api/logistics/vehicles/{vehicleId}/expenses")
public class VehicleExpenseController {

    private final VehicleExpenseService service;

    public VehicleExpenseController(
            VehicleExpenseService service
    ) {
        this.service = service;
    }

    @GetMapping
    public List<VehicleExpense> getByVehicle(
            @PathVariable UUID vehicleId
    ) {
        return service.getByVehicle(vehicleId);
    }

    @PostMapping
    public VehicleExpense create(
            @PathVariable UUID vehicleId,
            @RequestBody VehicleExpenseRequest request
    ) {
        return service.create(
                vehicleId,
                request
        );
    }
}