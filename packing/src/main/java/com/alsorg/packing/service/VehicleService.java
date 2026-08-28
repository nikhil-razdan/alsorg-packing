package com.alsorg.packing.service;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class VehicleService {

    private static final int MAX_VEHICLE_NUMBER = 40;
    private static final int MAX_SHORT_TEXT = 120;

    private final VehicleRepository repository;

    public VehicleService(
            VehicleRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Vehicle create(
            Vehicle vehicle) {
        return create(vehicle, false);
    }

    @Transactional
    public Vehicle create(
            Vehicle vehicle,
            boolean allowMissingVehicleType) {
        requireVehicleRequest(vehicle);
        normalizeVehicle(vehicle);
        validateVehicle(vehicle, allowMissingVehicleType);

        if (repository.existsByVehicleNumberIgnoreCase(
                vehicle.getVehicleNumber())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Vehicle already exists: "
                            + vehicle.getVehicleNumber());
        }

        return repository.save(vehicle);
    }

    @Transactional(readOnly = true)
    public List<Vehicle> getAll() {
        /* Compatibility endpoint retained for existing clients. */
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public Page<Vehicle> getPage(
            Pageable pageable) {
        if (pageable == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle page request is required");
        }

        return repository.findAll(pageable);
    }

    @Transactional
    public Vehicle update(
            UUID id,
            Vehicle request) {
        if (id == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle id is required");
        }

        requireVehicleRequest(request);
        normalizeVehicle(request);
        validateVehicle(request, false);

        Vehicle vehicle = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Vehicle not found"));

        if (repository.existsByVehicleNumberIgnoreCaseAndIdNot(
                request.getVehicleNumber(),
                id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Vehicle number already exists");
        }

        vehicle.setVehicleNumber(request.getVehicleNumber());
        vehicle.setVehicleName(request.getVehicleName());
        vehicle.setVehicleType(request.getVehicleType());
        vehicle.setDriverName(request.getDriverName());
        vehicle.setOwnerName(request.getOwnerName());
        vehicle.setRegisteringAuthority(request.getRegisteringAuthority());
        vehicle.setVehicleClass(request.getVehicleClass());
        vehicle.setFuelType(request.getFuelType());
        vehicle.setFuelCapacity(request.getFuelCapacity());
        vehicle.setEmissionNorm(request.getEmissionNorm());
        vehicle.setVehicleAge(request.getVehicleAge());
        vehicle.setStatus(request.getStatus());
        vehicle.setActive(request.isActive());
        vehicle.setCapacity(request.getCapacity());
        vehicle.setRegistrationDate(request.getRegistrationDate());
        vehicle.setFitnessValidUpto(request.getFitnessValidUpto());
        vehicle.setInsuranceValidUpto(request.getInsuranceValidUpto());
        vehicle.setTaxValidUpto(request.getTaxValidUpto());
        vehicle.setPermitValidUpto(request.getPermitValidUpto());
        vehicle.setPuccValidUpto(request.getPuccValidUpto());
        vehicle.setNationalPermitValidUpto(request.getNationalPermitValidUpto());

        normalizeVehicle(vehicle);

        return repository.save(vehicle);
    }

    @Transactional
    public void delete(
            UUID id) {
        if (id == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle id is required");
        }

        Vehicle vehicle = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Vehicle not found"));

        repository.delete(vehicle);
    }

    private void requireVehicleRequest(
            Vehicle vehicle) {
        if (vehicle == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle request is required");
        }
    }

    private void validateVehicle(
            Vehicle vehicle,
            boolean allowMissingVehicleType) {
        if (vehicle.getVehicleNumber() == null
                || vehicle.getVehicleNumber().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle number is required");
        }

        if (vehicle.getVehicleNumber().length() > MAX_VEHICLE_NUMBER) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle number is too long");
        }

        if (!allowMissingVehicleType
                && (vehicle.getVehicleType() == null
                        || vehicle.getVehicleType().isBlank())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle type is required");
        }
    }

    private void normalizeVehicle(
            Vehicle vehicle) {
        String vehicleNumber = cleanLimited(
                vehicle.getVehicleNumber(),
                MAX_VEHICLE_NUMBER,
                "Vehicle number");

        vehicle.setVehicleNumber(
                vehicleNumber == null
                        ? null
                        : vehicleNumber
                                .toUpperCase()
                                .replaceAll("\\s+", ""));

        vehicle.setVehicleName(cleanLimited(vehicle.getVehicleName(), MAX_SHORT_TEXT, "Vehicle name"));
        vehicle.setVehicleType(cleanLimited(vehicle.getVehicleType(), MAX_SHORT_TEXT, "Vehicle type"));
        vehicle.setDriverName(cleanLimited(vehicle.getDriverName(), MAX_SHORT_TEXT, "Driver name"));
        vehicle.setOwnerName(cleanLimited(vehicle.getOwnerName(), MAX_SHORT_TEXT, "Owner name"));
        vehicle.setRegisteringAuthority(cleanLimited(vehicle.getRegisteringAuthority(), MAX_SHORT_TEXT, "Registering authority"));
        vehicle.setVehicleClass(cleanLimited(vehicle.getVehicleClass(), MAX_SHORT_TEXT, "Vehicle class"));
        vehicle.setFuelType(cleanLimited(vehicle.getFuelType(), MAX_SHORT_TEXT, "Fuel type"));
        vehicle.setFuelCapacity(cleanLimited(vehicle.getFuelCapacity(), MAX_SHORT_TEXT, "Fuel capacity"));
        vehicle.setEmissionNorm(cleanLimited(vehicle.getEmissionNorm(), MAX_SHORT_TEXT, "Emission norm"));
        vehicle.setVehicleAge(cleanLimited(vehicle.getVehicleAge(), MAX_SHORT_TEXT, "Vehicle age"));

        String status = cleanLimited(vehicle.getStatus(), 60, "Vehicle status");
        vehicle.setStatus(status == null ? "Active" : status);

        /* Preserve the existing status-driven active flag semantics. */
        vehicle.setActive(!"Inactive".equalsIgnoreCase(vehicle.getStatus()));
    }

    private String cleanLimited(
            String value,
            int maxLength,
            String label) {
        if (value == null) {
            return null;
        }

        String cleaned = value.trim();

        if (cleaned.isBlank()) {
            return null;
        }

        if (cleaned.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    label + " cannot exceed "
                            + maxLength + " characters");
        }

        return cleaned;
    }
}
