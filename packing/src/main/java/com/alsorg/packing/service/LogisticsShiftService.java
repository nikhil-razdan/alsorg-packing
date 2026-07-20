package com.alsorg.packing.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.controller.dto.logistics.CreateShiftRequest;
import com.alsorg.packing.controller.dto.logistics.UpdateShiftStatusRequest;
import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.LogisticsShift;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.LogisticsShiftRepository;
import com.alsorg.packing.repository.VehicleRepository;

@Service
@Transactional
public class LogisticsShiftService {

        private static final List<String> ALLOWED_STATUSES = List.of(
                        "WORKING",
                        "OFF",
                        "ON_LEAVE",
                        "COMPLETED",
                        "CANCELLED");

        private final LogisticsShiftRepository shiftRepository;
        private final DriverRepository driverRepository;
        private final VehicleRepository vehicleRepository;

        public LogisticsShiftService(
                        LogisticsShiftRepository shiftRepository,
                        DriverRepository driverRepository,
                        VehicleRepository vehicleRepository) {
                this.shiftRepository = shiftRepository;
                this.driverRepository = driverRepository;
                this.vehicleRepository = vehicleRepository;
        }

        public LogisticsShift createShift(
                        CreateShiftRequest request) {
                validateRequest(request);

                Driver driver = requireDriver(
                                request.getDriverId());

                Vehicle vehicle = requireVehicle(
                                request.getVehicleId());

                LogisticsShift shift = new LogisticsShift();

                applyRequest(
                                shift,
                                request,
                                driver,
                                vehicle);

                shift.setCreatedAt(
                                LocalDateTime.now());

                return shiftRepository.save(shift);
        }

        @Transactional(readOnly = true)
        public List<LogisticsShift> getAllShifts() {
                return shiftRepository
                                .findAllByOrderByShiftStartDesc();
        }

        public void deleteShift(UUID id) {
                LogisticsShift shift = requireShift(id);

                shiftRepository.delete(shift);
        }

        public LogisticsShift updateShift(
                        UUID id,
                        CreateShiftRequest request) {
                validateRequest(request);

                LogisticsShift shift = requireShift(id);

                Driver driver = requireDriver(
                                request.getDriverId());

                Vehicle vehicle = requireVehicle(
                                request.getVehicleId());

                applyRequest(
                                shift,
                                request,
                                driver,
                                vehicle);

                return shiftRepository.save(shift);
        }

        public LogisticsShift updateShiftStatus(
                        UUID id,
                        UpdateShiftStatusRequest request) {
                LogisticsShift shift = requireShift(id);

                if (request == null) {
                        throw new RuntimeException(
                                        "Status request is required");
                }

                shift.setStatus(
                                normalizeStatus(
                                                request.getStatus()));

                return shiftRepository.save(shift);
        }

        private void applyRequest(
                        LogisticsShift shift,
                        CreateShiftRequest request,
                        Driver driver,
                        Vehicle vehicle) {
                LocalDateTime shiftStart = request.getShiftStart();

                LocalDateTime shiftEnd = request.getShiftEnd();

                double hours = calculateHours(
                                shiftStart,
                                shiftEnd);

                Integer trips = safeInteger(
                                request.getTotalTrips());

                Integer loaders = safeInteger(
                                request.getTotalLoaders());

                Double fuel = safeDouble(
                                request.getFuelUsed());

                shift.setDriver(driver);
                shift.setVehicle(vehicle);

                shift.setShiftStart(shiftStart);
                shift.setShiftEnd(shiftEnd);

                shift.setOvertimeHours(
                                safeDouble(
                                                request.getOvertimeHours()));

                shift.setTotalTrips(trips);
                shift.setTotalLoaders(loaders);
                shift.setFuelUsed(fuel);

                shift.setTotalDistance(
                                safeDouble(
                                                request.getTotalDistance()));

                shift.setRouteCategory(
                                cleanOrDefault(
                                                request.getRouteCategory(),
                                                "Factory"));

                shift.setRemarks(
                                cleanOrNull(
                                                request.getRemarks()));

                shift.setStatus(
                                normalizeStatus(
                                                request.getStatus()));

                shift.setTotalWorkingHours(hours);

                shift.setDriverPerformance(
                                calculatePerformance(
                                                trips,
                                                loaders,
                                                hours,
                                                fuel));
        }

        private void validateRequest(
                        CreateShiftRequest request) {
                if (request == null) {
                        throw new RuntimeException(
                                        "Shift request is required");
                }

                if (request.getDriverId() == null) {
                        throw new RuntimeException(
                                        "Driver is required");
                }

                if (request.getVehicleId() == null) {
                        throw new RuntimeException(
                                        "Vehicle is required");
                }

                validateShiftTimes(
                                request.getShiftStart(),
                                request.getShiftEnd());
        }

        private Driver requireDriver(
                        UUID driverId) {
                if (driverId == null) {
                        throw new RuntimeException(
                                        "Driver is required");
                }

                return driverRepository
                                .findById(driverId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Driver not found"));
        }

        private Vehicle requireVehicle(
                        UUID vehicleId) {
                if (vehicleId == null) {
                        throw new RuntimeException(
                                        "Vehicle is required");
                }

                return vehicleRepository
                                .findById(vehicleId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Vehicle not found"));
        }

        private LogisticsShift requireShift(
                        UUID id) {
                if (id == null) {
                        throw new RuntimeException(
                                        "Shift id is required");
                }

                return shiftRepository
                                .findById(id)
                                .orElseThrow(() -> new RuntimeException(
                                                "Shift not found"));
        }

        private void validateShiftTimes(
                        LocalDateTime shiftStart,
                        LocalDateTime shiftEnd) {
                if (shiftStart == null ||
                                shiftEnd == null) {
                        throw new RuntimeException(
                                        "Shift start and shift end are required");
                }

                if (!shiftEnd.isAfter(shiftStart)) {
                        throw new RuntimeException(
                                        "Shift end time must be after shift start time");
                }
        }

        private double calculateHours(
                        LocalDateTime start,
                        LocalDateTime end) {
                validateShiftTimes(
                                start,
                                end);

                long minutes = Duration.between(
                                start,
                                end).toMinutes();

                return Math.max(
                                minutes / 60.0,
                                0);
        }

        private double calculatePerformance(
                        Integer trips,
                        Integer loaders,
                        Double hours,
                        Double fuel) {
                int safeTrips = safeInteger(trips);

                int safeLoaders = safeInteger(loaders);

                double safeHours = safeDouble(hours);

                double safeFuel = safeDouble(fuel);

                double tripScore = safeTrips * 10.0;

                double loaderScore = safeLoaders * 3.0;

                double efficiencyScore = safeHours <= 0
                                ? 0
                                : (safeTrips * 8.0)
                                                / safeHours;

                double fuelPenalty = safeFuel * 0.4;

                double finalScore = tripScore
                                + loaderScore
                                + efficiencyScore
                                - fuelPenalty;

                return Math.max(
                                finalScore,
                                0);
        }

        private String normalizeStatus(
                        String status) {
                String normalized = cleanOrDefault(
                                status,
                                "WORKING")
                                .toUpperCase(
                                                Locale.ROOT);

                if (!ALLOWED_STATUSES.contains(
                                normalized)) {
                        throw new RuntimeException(
                                        "Unsupported shift status: "
                                                        + normalized);
                }

                return normalized;
        }

        private int safeInteger(
                        Integer value) {
                return value == null
                                ? 0
                                : Math.max(value, 0);
        }

        private double safeDouble(
                        Double value) {
                if (value == null ||
                                !Double.isFinite(value)) {
                        return 0;
                }

                return Math.max(
                                value,
                                0);
        }

        private String cleanOrDefault(
                        String value,
                        String fallback) {
                if (value == null ||
                                value.trim().isEmpty()) {
                        return fallback;
                }

                return value.trim();
        }

        private String cleanOrNull(
                        String value) {
                if (value == null ||
                                value.trim().isEmpty()) {
                        return null;
                }

                return value.trim();
        }
}