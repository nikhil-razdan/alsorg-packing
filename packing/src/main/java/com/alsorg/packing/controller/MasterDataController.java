package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.VehicleRepository;

@RestController
@RequestMapping("/api/logistics/master")
@CrossOrigin("*")
public class MasterDataController {

    private final DriverRepository driverRepository;

    private final VehicleRepository vehicleRepository;

    public MasterDataController(
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository
    ) {
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
    }

    @GetMapping("/drivers")
    public List<Driver> getDrivers() {
        return driverRepository.findAll();
    }

    @GetMapping("/vehicles")
    public List<Vehicle> getVehicles() {
        return vehicleRepository.findAll();
    }
}