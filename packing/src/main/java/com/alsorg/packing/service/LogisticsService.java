package com.alsorg.packing.service;

import org.springframework.stereotype.Service;

import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.LogisticsShiftRepository;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class LogisticsService {

    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final LogisticsShiftRepository shiftRepository;

    public LogisticsService(
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository,
            LogisticsShiftRepository shiftRepository
    ) {
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
        this.shiftRepository = shiftRepository;
    }
}