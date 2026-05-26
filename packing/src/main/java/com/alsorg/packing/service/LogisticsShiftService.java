package com.alsorg.packing.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.LogisticsShift;
import com.alsorg.packing.domain.logistics.Vehicle;
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

    /*
     * CREATE SHIFT
     */

    @Transactional
    public LogisticsShift createShift(
            LogisticsShift shift
    ) {

        Driver driver = driverRepository.findById(
                shift.getDriver().getId()
        ).orElseThrow(() ->
                new RuntimeException("Driver not found")
        );

        Vehicle vehicle = vehicleRepository.findById(
                shift.getVehicle().getId()
        ).orElseThrow(() ->
                new RuntimeException("Vehicle not found")
        );

        shift.setDriver(driver);

        shift.setVehicle(vehicle);

        /*
         * TOTAL WORKING HOURS
         */

        if (
                shift.getShiftStart() != null
                &&
                shift.getShiftEnd() != null
        ) {

            double hours =
                    Duration.between(
                            shift.getShiftStart(),
                            shift.getShiftEnd()
                    ).toMinutes() / 60.0;

            shift.setTotalWorkingHours(hours);
        }

        /*
         * DRIVER PERFORMANCE SCORE
         */

        double performance = calculatePerformance(shift);

        shift.setDriverPerformance(performance);

        shift.setCreatedAt(LocalDateTime.now());

        return shiftRepository.save(shift);
    }

    /*
     * GET ALL SHIFTS
     */

    public List<LogisticsShift> getAll() {
        return shiftRepository.findAll();
    }

    /*
     * PERFORMANCE ENGINE
     */

    private double calculatePerformance(
            LogisticsShift shift
    ) {

        double score = 0;

        /*
         * TRIPS
         */

        score += (shift.getTotalTrips() != null
                ? shift.getTotalTrips() * 5
                : 0);

        /*
         * LOADERS
         */

        score += (shift.getTotalLoaders() != null
                ? shift.getTotalLoaders() * 2
                : 0);

        /*
         * OVERTIME BONUS
         */

        score += (shift.getOvertimeHours() != null
                ? shift.getOvertimeHours() * 1.5
                : 0);

        /*
         * DISTANCE BONUS
         */

        score += (shift.getTotalDistance() != null
                ? shift.getTotalDistance() * 0.05
                : 0);

        return Math.round(score * 100.0) / 100.0;
    }
}