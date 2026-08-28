package com.alsorg.packing.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;

import com.alsorg.packing.config.TimeZoneConfig;
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

        private static final java.time.ZoneId APP_ZONE = TimeZoneConfig.APP_ZONE;
        private static final int MAX_SHIFT_PAGE_SIZE = 100;

        private static final List<String> ALLOWED_STATUSES = List.of(
                        "WORKING",
                        "OFF",
                        "ON_LEAVE",
                        "COMPLETED",
                        "CANCELLED");

        private final LogisticsShiftRepository shiftRepository;
        private final DriverRepository driverRepository;
        private final VehicleRepository vehicleRepository;

        @PersistenceContext
        private EntityManager entityManager;

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
                                LocalDateTime.now(APP_ZONE));

                return shiftRepository.save(shift);
        }

        @Transactional(readOnly = true)
        public List<LogisticsShift> getAllShifts() {
                return shiftRepository
                                .findAllByOrderByShiftStartDesc();
        }

        /**
         * Server-paged compatibility path for the scalable Logistics frontend.
         *
         * The legacy full-list method above remains available until every
         * dashboard/report endpoint has its own server-side aggregate contract.
         */
        @Transactional(readOnly = true)
        public Page<LogisticsShift> getShifts(
                        Pageable pageable) {

                if (pageable == null) {
                        throw badRequest(
                                        "Shift page request is required");
                }

                Pageable safePageable = PageRequest.of(
                                Math.max(0, pageable.getPageNumber()),
                                Math.max(
                                                1,
                                                Math.min(
                                                                pageable.getPageSize(),
                                                                MAX_SHIFT_PAGE_SIZE)),
                                pageable.getSort().isSorted()
                                                ? pageable.getSort()
                                                : Sort.by(
                                                                Sort.Direction.DESC,
                                                                "shiftStart"));

                return shiftRepository.findAll(
                                safePageable);
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
                        throw badRequest(
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
                        throw badRequest(
                                        "Shift request is required");
                }

                if (request.getDriverId() == null) {
                        throw badRequest(
                                        "Driver is required");
                }

                if (request.getVehicleId() == null) {
                        throw badRequest(
                                        "Vehicle is required");
                }

                validateShiftTimes(
                                request.getShiftStart(),
                                request.getShiftEnd());
        }

        private Driver requireDriver(
                        UUID driverId) {
                if (driverId == null) {
                        throw badRequest(
                                        "Driver is required");
                }

                return driverRepository
                                .findById(driverId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Driver not found"));
        }

        private Vehicle requireVehicle(
                        UUID vehicleId) {
                if (vehicleId == null) {
                        throw badRequest(
                                        "Vehicle is required");
                }

                return vehicleRepository
                                .findById(vehicleId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Vehicle not found"));
        }

        private LogisticsShift requireShift(
                        UUID id) {
                if (id == null) {
                        throw badRequest(
                                        "Shift id is required");
                }

                LogisticsShift shift = entityManager.find(
                                LogisticsShift.class,
                                id,
                                LockModeType.PESSIMISTIC_WRITE);

                if (shift == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Shift not found");
                }

                return shift;
        }

        private void validateShiftTimes(
                        LocalDateTime shiftStart,
                        LocalDateTime shiftEnd) {
                if (shiftStart == null ||
                                shiftEnd == null) {
                        throw badRequest(
                                        "Shift start and shift end are required");
                }

                if (!shiftEnd.isAfter(shiftStart)) {
                        throw badRequest(
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
                        throw badRequest(
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

                String clean = value.trim();

                if (clean.length() > 120) {
                        throw badRequest(
                                        "Route category is too long");
                }

                return clean;
        }

        private String cleanOrNull(
                        String value) {
                if (value == null ||
                                value.trim().isEmpty()) {
                        return null;
                }

                String clean = value.trim();

                if (clean.length() > 2000) {
                        throw badRequest(
                                        "Shift remarks are too long");
                }

                return clean;
        }

        private ResponseStatusException badRequest(
                        String message) {
                return new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                message);
        }
}