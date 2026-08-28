package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

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

    @GetMapping
    public ResponseEntity<List<Driver>> getAll() {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS");
        return ResponseEntity.ok(service.getAll());
    }

    @PostMapping
    public ResponseEntity<Driver> create(
            @RequestBody(required = false) Driver driver) {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS");
        return ResponseEntity.ok(service.create(driver));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id) {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "LOGISTICS");
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private void requireAnyRole(
            User user,
            String... roles) {
        if (!currentUserService.hasAnyRole(user, roles)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to manage drivers");
        }
    }
}
