package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DriverService;

@RestController
@RequestMapping("/api/logistics/drivers")
public class DriverController {

    private final DriverService service;
    private final CurrentUserService currentUserService;

    public DriverController(
            DriverService service,
            CurrentUserService currentUserService) {

        this.service = service;
        this.currentUserService = currentUserService;
    }

    /*
     * ADMIN, DISPATCH and LOGISTICS need this endpoint
     * because the challan dropdown loads the driver list.
     */
    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService
                .getCurrentUserFromAuth(auth);

        if (!canViewDriverMaster(user)) {
            return ResponseEntity
                    .status(403)
                    .body(
                            "You do not have permission to view drivers");
        }

        List<Driver> drivers = service.getAll();

        return ResponseEntity.ok(drivers);
    }

    /*
     * Dispatch users are allowed to create a driver directly
     * while generating a normal or custom challan.
     */
    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Driver driver,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService
                .getCurrentUserFromAuth(auth);

        if (!canCreateDriver(user)) {
            return ResponseEntity
                    .status(403)
                    .body(
                            "Only ADMIN, DISPATCH or LOGISTICS can create drivers");
        }

        Driver created = service.create(driver);

        return ResponseEntity.ok(created);
    }

    /*
     * Deletion is intentionally stricter.
     * DISPATCH may create a missing driver but should not
     * delete master records from inside the challan workflow.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable UUID id,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService
                .getCurrentUserFromAuth(auth);

        if (!canDeleteDriver(user)) {
            return ResponseEntity
                    .status(403)
                    .body(
                            "Only ADMIN or LOGISTICS can delete drivers");
        }

        service.delete(id);

        return ResponseEntity
                .noContent()
                .build();
    }

    private boolean canViewDriverMaster(
            User user) {

        return currentUserService.isAdmin(user)
                || currentUserService.isDispatch(user)
                || currentUserService.isLogistics(user);
    }

    private boolean canCreateDriver(
            User user) {

        return currentUserService.isAdmin(user)
                || currentUserService.isDispatch(user)
                || currentUserService.isLogistics(user);
    }

    private boolean canDeleteDriver(
            User user) {

        return currentUserService.isAdmin(user)
                || currentUserService.isLogistics(user);
    }
}