package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.logistics.Vehicle;

public interface VehicleRepository
extends JpaRepository<Vehicle, UUID> {

boolean existsByVehicleNumberIgnoreCase(
    String vehicleNumber
);
}