package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.service.VehicleService;

@RestController
@RequestMapping("/api/logistics/vehicles")
public class VehicleController {

    private final VehicleService service;

    public VehicleController(
            VehicleService service
    ) {
        this.service = service;
    }

    /*
     * CREATE
     */

    @PostMapping
    public Vehicle create(
            @RequestBody Vehicle vehicle
    ) {
        return service.create(vehicle);
    }

    /*
     * GET ALL
     */

    @GetMapping
    public List<Vehicle> getAll() {
        return service.getAll();
    }

    /*
     * DELETE
     */

    @DeleteMapping("/{id}")
    public void delete(
            @PathVariable UUID id
    ) {
        service.delete(id);
    }
}