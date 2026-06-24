package com.alsorg.packing.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class VehicleService {

    private final VehicleRepository repository;

    public VehicleService(
            VehicleRepository repository
    ) {
        this.repository = repository;
    }

    /*
     * CREATE VEHICLE
     */

    @Transactional
    public Vehicle create(Vehicle vehicle) {

        validateVehicle(vehicle);

        if (repository.existsByVehicleNumberIgnoreCase(
                vehicle.getVehicleNumber()
        )) {
            throw new RuntimeException(
                    "Vehicle already exists"
            );
        }

        normalizeVehicle(vehicle);

        return repository.save(vehicle);
    }

    /*
     * GET ALL
     */

    public List<Vehicle> getAll() {
        return repository.findAll();
    }

    /*
     * UPDATE VEHICLE
     */

    @Transactional
    public Vehicle update(
            UUID id,
            Vehicle request
    ) {
        Vehicle vehicle = repository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Vehicle not found"
                        ));

        validateVehicle(request);

        if (
                request.getVehicleNumber() != null &&
                repository.existsByVehicleNumberIgnoreCaseAndIdNot(
                        request.getVehicleNumber(),
                        id
                )
        ) {
            throw new RuntimeException(
                    "Vehicle number already exists"
            );
        }

        vehicle.setVehicleNumber(
                request.getVehicleNumber()
        );

        vehicle.setVehicleName(
                request.getVehicleName()
        );

        vehicle.setVehicleType(
                request.getVehicleType()
        );

        vehicle.setDriverName(
                request.getDriverName()
        );

        vehicle.setOwnerName(
                request.getOwnerName()
        );

        vehicle.setRegisteringAuthority(
                request.getRegisteringAuthority()
        );

        vehicle.setVehicleClass(
                request.getVehicleClass()
        );

        vehicle.setFuelType(
                request.getFuelType()
        );

        vehicle.setFuelCapacity(
                request.getFuelCapacity()
        );

        vehicle.setEmissionNorm(
                request.getEmissionNorm()
        );

        vehicle.setVehicleAge(
                request.getVehicleAge()
        );

        vehicle.setStatus(
                request.getStatus()
        );

        vehicle.setActive(
                request.isActive()
        );

        vehicle.setCapacity(
                request.getCapacity()
        );

        vehicle.setRegistrationDate(
                request.getRegistrationDate()
        );

        vehicle.setFitnessValidUpto(
                request.getFitnessValidUpto()
        );

        vehicle.setInsuranceValidUpto(
                request.getInsuranceValidUpto()
        );

        vehicle.setTaxValidUpto(
                request.getTaxValidUpto()
        );

        vehicle.setPermitValidUpto(
                request.getPermitValidUpto()
        );

        vehicle.setPuccValidUpto(
                request.getPuccValidUpto()
        );

        vehicle.setNationalPermitValidUpto(
                request.getNationalPermitValidUpto()
        );

        normalizeVehicle(vehicle);

        return repository.save(vehicle);
    }

    /*
     * DELETE
     */

    @Transactional
    public void delete(UUID id) {

        Vehicle vehicle = repository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Vehicle not found"
                        ));

        repository.delete(vehicle);
    }

    /*
     * HELPERS
     */

    private void validateVehicle(
            Vehicle vehicle
    ) {
        if (
                vehicle.getVehicleNumber() == null ||
                vehicle.getVehicleNumber().trim().isBlank()
        ) {
            throw new RuntimeException(
                    "Vehicle number is required"
            );
        }

        if (
                vehicle.getVehicleType() == null ||
                vehicle.getVehicleType().trim().isBlank()
        ) {
            throw new RuntimeException(
                    "Vehicle type is required"
            );
        }
    }

    private void normalizeVehicle(
            Vehicle vehicle
    ) {
        vehicle.setVehicleNumber(
                clean(vehicle.getVehicleNumber())
        );

        vehicle.setVehicleName(
                clean(vehicle.getVehicleName())
        );

        vehicle.setVehicleType(
                clean(vehicle.getVehicleType())
        );

        vehicle.setDriverName(
                clean(vehicle.getDriverName())
        );

        vehicle.setOwnerName(
                clean(vehicle.getOwnerName())
        );

        vehicle.setRegisteringAuthority(
                clean(vehicle.getRegisteringAuthority())
        );

        vehicle.setVehicleClass(
                clean(vehicle.getVehicleClass())
        );

        vehicle.setFuelType(
                clean(vehicle.getFuelType())
        );

        vehicle.setFuelCapacity(
                clean(vehicle.getFuelCapacity())
        );

        vehicle.setEmissionNorm(
                clean(vehicle.getEmissionNorm())
        );

        vehicle.setVehicleAge(
                clean(vehicle.getVehicleAge())
        );

        if (
                vehicle.getStatus() == null ||
                vehicle.getStatus().trim().isBlank()
        ) {
            vehicle.setStatus("Active");
        } else {
            vehicle.setStatus(
                    clean(vehicle.getStatus())
            );
        }

        vehicle.setActive(
                !"Inactive".equalsIgnoreCase(
                        vehicle.getStatus()
                )
        );
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String cleaned = value.trim();

        return cleaned.isBlank()
                ? null
                : cleaned;
    }
}