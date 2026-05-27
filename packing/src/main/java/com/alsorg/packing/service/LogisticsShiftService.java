package com.alsorg.packing.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.LogisticsShift;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.controller.dto.logistics.CreateShiftRequest;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.LogisticsShiftRepository;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class LogisticsShiftService {

    private final LogisticsShiftRepository shiftRepository;

    private final DriverRepository driverRepository;

    private final VehicleRepository vehicleRepository;

    public LogisticsShiftService(
            LogisticsShiftRepository shiftRepository,
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository
    ) {
        this.shiftRepository = shiftRepository;
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
    }

    public LogisticsShift createShift(
            CreateShiftRequest request
    ) {

        Driver driver = driverRepository
                .findById(request.getDriverId())
                .orElseThrow(() ->
                        new RuntimeException("Driver not found"));

        Vehicle vehicle = vehicleRepository
                .findById(request.getVehicleId())
                .orElseThrow(() ->
                        new RuntimeException("Vehicle not found"));

        LogisticsShift shift = new LogisticsShift();

        shift.setDriver(driver);

        shift.setVehicle(vehicle);

        shift.setShiftStart(request.getShiftStart());

        shift.setShiftEnd(request.getShiftEnd());

        shift.setOvertimeHours(
                request.getOvertimeHours()
        );

        shift.setTotalTrips(
                request.getTotalTrips()
        );

        shift.setTotalLoaders(
                request.getTotalLoaders()
        );

        shift.setFuelUsed(
                request.getFuelUsed()
        );

        shift.setTotalDistance(
                request.getTotalDistance()
        );

        shift.setRouteCategory(
                request.getRouteCategory()
        );

        shift.setRemarks(
                request.getRemarks()
        );

        shift.setStatus(
                request.getStatus()
        );

        /*
        ========================================
        AUTO CALCULATIONS
        ========================================
        */

        double hours =
                Duration.between(
                        request.getShiftStart(),
                        request.getShiftEnd()
                ).toMinutes() / 60.0;

        shift.setTotalWorkingHours(hours);

        /*
        ========================================
        DRIVER PERFORMANCE SCORE
        ========================================
        */

        double performance = calculatePerformance(
                request.getTotalTrips(),
                request.getTotalLoaders(),
                hours,
                request.getFuelUsed()
        );

        shift.setDriverPerformance(performance);

        shift.setCreatedAt(
                LocalDateTime.now()
        );

        return shiftRepository.save(shift);
    }

    public List<LogisticsShift> getAllShifts() {

        return shiftRepository.findAll();
    }
    
    public void deleteShift(UUID id) {

        LogisticsShift shift =
                shiftRepository.findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Shift not found"
                                ));

        shiftRepository.delete(shift);
    }
    /*
    ========================================
    PERFORMANCE ENGINE
    ========================================
    */

    private double calculatePerformance(
            Integer trips,
            Integer loaders,
            Double hours,
            Double fuel
    ) {

        double tripScore =
                trips == null ? 0 : trips * 10;

        double loaderScore =
                loaders == null ? 0 : loaders * 3;

        double efficiencyScore =
                hours == 0 ? 0 :
                        (trips * 8.0) / hours;

        double fuelPenalty =
                fuel == null ? 0 : fuel * 0.4;

        double finalScore =
                tripScore +
                loaderScore +
                efficiencyScore -
                fuelPenalty;

        return Math.max(finalScore, 0);
    }
}