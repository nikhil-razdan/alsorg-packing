package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDate;
import java.util.UUID;

public class VehicleResponse {

    private UUID id;
    private String vehicleNumber;
    private String vehicleName;
    private String vehicleType;
    private Double capacity;
    private boolean active;
    private String status;
    private String driverName;
    private String ownerName;
    private String registeringAuthority;
    private String vehicleClass;
    private String fuelType;
    private String fuelCapacity;
    private String emissionNorm;
    private String vehicleAge;
    private LocalDate registrationDate;
    private LocalDate fitnessValidUpto;
    private LocalDate insuranceValidUpto;
    private LocalDate taxValidUpto;
    private LocalDate permitValidUpto;
    private LocalDate puccValidUpto;
    private LocalDate nationalPermitValidUpto;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getVehicleNumber() {
        return vehicleNumber;
    }

    public void setVehicleNumber(String vehicleNumber) {
        this.vehicleNumber = vehicleNumber;
    }

    public String getVehicleName() {
        return vehicleName;
    }

    public void setVehicleName(String vehicleName) {
        this.vehicleName = vehicleName;
    }

    public String getVehicleType() {
        return vehicleType;
    }

    public void setVehicleType(String vehicleType) {
        this.vehicleType = vehicleType;
    }

    public Double getCapacity() {
        return capacity;
    }

    public void setCapacity(Double capacity) {
        this.capacity = capacity;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDriverName() {
        return driverName;
    }

    public void setDriverName(String driverName) {
        this.driverName = driverName;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getRegisteringAuthority() {
        return registeringAuthority;
    }

    public void setRegisteringAuthority(String registeringAuthority) {
        this.registeringAuthority = registeringAuthority;
    }

    public String getVehicleClass() {
        return vehicleClass;
    }

    public void setVehicleClass(String vehicleClass) {
        this.vehicleClass = vehicleClass;
    }

    public String getFuelType() {
        return fuelType;
    }

    public void setFuelType(String fuelType) {
        this.fuelType = fuelType;
    }

    public String getFuelCapacity() {
        return fuelCapacity;
    }

    public void setFuelCapacity(String fuelCapacity) {
        this.fuelCapacity = fuelCapacity;
    }

    public String getEmissionNorm() {
        return emissionNorm;
    }

    public void setEmissionNorm(String emissionNorm) {
        this.emissionNorm = emissionNorm;
    }

    public String getVehicleAge() {
        return vehicleAge;
    }

    public void setVehicleAge(String vehicleAge) {
        this.vehicleAge = vehicleAge;
    }

    public LocalDate getRegistrationDate() {
        return registrationDate;
    }

    public void setRegistrationDate(LocalDate registrationDate) {
        this.registrationDate = registrationDate;
    }

    public LocalDate getFitnessValidUpto() {
        return fitnessValidUpto;
    }

    public void setFitnessValidUpto(LocalDate fitnessValidUpto) {
        this.fitnessValidUpto = fitnessValidUpto;
    }

    public LocalDate getInsuranceValidUpto() {
        return insuranceValidUpto;
    }

    public void setInsuranceValidUpto(LocalDate insuranceValidUpto) {
        this.insuranceValidUpto = insuranceValidUpto;
    }

    public LocalDate getTaxValidUpto() {
        return taxValidUpto;
    }

    public void setTaxValidUpto(LocalDate taxValidUpto) {
        this.taxValidUpto = taxValidUpto;
    }

    public LocalDate getPermitValidUpto() {
        return permitValidUpto;
    }

    public void setPermitValidUpto(LocalDate permitValidUpto) {
        this.permitValidUpto = permitValidUpto;
    }

    public LocalDate getPuccValidUpto() {
        return puccValidUpto;
    }

    public void setPuccValidUpto(LocalDate puccValidUpto) {
        this.puccValidUpto = puccValidUpto;
    }

    public LocalDate getNationalPermitValidUpto() {
        return nationalPermitValidUpto;
    }

    public void setNationalPermitValidUpto(LocalDate nationalPermitValidUpto) {
        this.nationalPermitValidUpto = nationalPermitValidUpto;
    }
}
