package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DriverService;
import com.alsorg.packing.service.VehicleService;

@RestController
@RequestMapping("/api/logistics/master")
public class MasterDataController {

    private final DriverService driverService;
    private final VehicleService vehicleService;
    private final CurrentUserService currentUserService;

    public MasterDataController(
            DriverService driverService,
            VehicleService vehicleService,
            CurrentUserService currentUserService) {
        this.driverService = driverService;
        this.vehicleService = vehicleService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/drivers")
    public List<Driver> getDrivers() {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS");
        return driverService.getAll();
    }

    @GetMapping("/vehicles")
    public List<Vehicle> getVehicles() {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS", "DRIVER");
        return vehicleService.getAll();
    }

    private void requireAnyRole(
            User user,
            String... roles) {
        if (!currentUserService.hasAnyRole(user, roles)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to view logistics master data");
        }
    }
}
