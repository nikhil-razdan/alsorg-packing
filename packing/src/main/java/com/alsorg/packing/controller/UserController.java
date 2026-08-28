package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.UserService;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasAuthority('ADMIN')")
public class UserController {

    private final UserService service;

    public UserController(
            UserService service) {
        this.service = service;
    }

    @PostMapping
    public UserResponse createUser(
            @RequestBody(required = false) CreateUserRequest request) {
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "User request is required");
        }

        User user = service.createUser(
                request.username(),
                request.password(),
                request.role(),
                request.roles(),
                request.plantCodes(),
                request.driverId(),
                request.warehouseAccess(),
                request.modules());

        return toResponse(user);
    }

    @GetMapping
    public List<UserResponse> getUsers() {
        return service.getAllUsers()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PutMapping("/{id}")
    public UserResponse updateUser(
            @PathVariable Long id,
            @RequestBody(required = false) UpdateUserRequest request) {
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "User update request is required");
        }

        User user = service.updateUser(
                id,
                request.username(),
                request.role(),
                request.roles(),
                request.plantCodes(),
                request.driverId(),
                request.warehouseAccess(),
                request.modules());

        return toResponse(user);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> disableUser(
            @PathVariable Long id) {
        service.disableUser(id);
        return ResponseEntity.ok(Map.of("message", "User disabled"));
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @PathVariable Long id,
            @RequestBody(required = false) PasswordResetRequest request) {
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password reset request is required");
        }

        service.resetPassword(id, request.password());
        return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
    }

    @PutMapping("/{id}/revoke-sessions")
    public ResponseEntity<Map<String, String>> revokeSessions(
            @PathVariable Long id) {
        service.revokeSessions(id);
        return ResponseEntity.ok(Map.of("message", "All existing sessions revoked"));
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.getEffectiveRoles(),
                user.isEnabled(),
                user.getPlantCode(),
                user.getEffectivePlantCodes(),
                user.getEffectiveModules(),
                user.getDriverId(),
                user.isWarehouseAccess());
    }

    public record CreateUserRequest(
            String username,
            String password,
            String role,
            Set<String> roles,
            Set<String> plantCodes,
            UUID driverId,
            boolean warehouseAccess,
            Set<String> modules) {
    }

    public record UpdateUserRequest(
            String username,
            String role,
            Set<String> roles,
            Set<String> plantCodes,
            UUID driverId,
            boolean warehouseAccess,
            Set<String> modules) {
    }

    public record PasswordResetRequest(
            String password) {
    }

    public record UserResponse(
            Long id,
            String username,
            String role,
            Set<String> roles,
            boolean enabled,
            String plantCode,
            Set<String> plantCodes,
            Set<String> modules,
            UUID driverId,
            boolean warehouseAccess) {
    }
}
