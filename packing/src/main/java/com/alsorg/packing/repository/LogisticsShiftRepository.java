package com.alsorg.packing.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.logistics.LogisticsShift;

public interface LogisticsShiftRepository
        extends JpaRepository<LogisticsShift, UUID> {

    List<LogisticsShift>
    findByShiftStartBetween(
            LocalDateTime start,
            LocalDateTime end
    );

    long countByVehicle_Id(UUID vehicleId);

    long countByDriver_Id(UUID driverId);
}