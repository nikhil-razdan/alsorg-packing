package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.service.DriverService;

@RestController
@RequestMapping("/api/logistics/drivers")
public class DriverController {

    private final DriverService service;

    public DriverController(
            DriverService service
    ) {
        this.service = service;
    }

    /*
     * CREATE
     */

    @PostMapping
    public Driver create(
            @RequestBody Driver driver
    ) {
        return service.create(driver);
    }

    /*
     * GET ALL
     */

    @GetMapping
    public List<Driver> getAll() {
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