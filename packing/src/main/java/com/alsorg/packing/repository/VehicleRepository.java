package com.alsorg.packing.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.logistics.Vehicle;

@Repository
public interface VehicleRepository
        extends JpaRepository<Vehicle, UUID> {

    boolean existsByVehicleNumberIgnoreCase(String vehicleNumber);

    boolean existsByVehicleNumberIgnoreCaseAndIdNot(
            String vehicleNumber,
            UUID id);
}
