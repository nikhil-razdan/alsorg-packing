package com.alsorg.packing.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class VehicleService {

    private final VehicleRepository repository;

    public VehicleService(
            VehicleRepository repository
    ) {
        this.repository = repository;
    }

    /*
     * CREATE VEHICLE
     */

    @Transactional
    public Vehicle create(Vehicle vehicle) {

        if (repository.existsByVehicleNumberIgnoreCase(
                vehicle.getVehicleNumber()
        )) {
            throw new RuntimeException(
                    "Vehicle already exists"
            );
        }

        return repository.save(vehicle);
    }

    /*
     * GET ALL
     */

    public List<Vehicle> getAll() {
        return repository.findAll();
    }

    /*
     * DELETE
     */

    @Transactional
    public void delete(UUID id) {

        Vehicle vehicle = repository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Vehicle not found"
                        ));

        repository.delete(vehicle);
    }
}