package com.alsorg.packing.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.logistics.VehicleExpense;

public interface VehicleExpenseRepository
        extends JpaRepository<VehicleExpense, UUID> {

    List<VehicleExpense> findByVehicle_IdOrderByExpenseMonthDescCreatedAtDesc(
            UUID vehicleId
    );
}