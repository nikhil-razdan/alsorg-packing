package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.UserService;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasAuthority('ADMIN')")
public class UserController {

    private final UserService service;

    public UserController(
            UserService service
    ) {
        this.service = service;
    }

    @PostMapping
    public UserResponse createUser(
            @RequestBody CreateUserRequest request
    ) {
        User user =
                service.createUser(
                        request.username(),
                        request.password(),
                        request.role(),
                        request.plantCodes(),
                        request.driverId(),
                        request.warehouseAccess(),
                        request.modules()
                );

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
            @RequestBody UpdateUserRequest request
    ) {
        User user =
                service.updateUser(
                        id,
                        request.username(),
                        request.role(),
                        request.plantCodes(),
                        request.driverId(),
                        request.warehouseAccess(),
                        request.modules()
                );

        return toResponse(user);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> disableUser(
            @PathVariable Long id
    ) {
        service.disableUser(id);

        return ResponseEntity.ok(
                Map.of("message", "User disabled")
        );
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> resetPassword(
            @PathVariable Long id,
            @RequestBody PasswordResetRequest request
    ) {
        service.resetPassword(
                id,
                request.password()
        );

        return ResponseEntity.ok(
                Map.of("message", "Password updated successfully")
        );
    }

    private UserResponse toResponse(
            User user
    ) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.isEnabled(),
                user.getPlantCode(),
                user.getEffectivePlantCodes(),
                user.getEffectiveModules(),
                user.getDriverId(),
                user.isWarehouseAccess()
        );
    }

    public record CreateUserRequest(
            String username,
            String password,
            String role,
            Set<String> plantCodes,
            UUID driverId,
            boolean warehouseAccess,
            Set<String> modules
    ) {
    }

    public record UpdateUserRequest(
            String username,
            String role,
            Set<String> plantCodes,
            UUID driverId,
            boolean warehouseAccess,
            Set<String> modules
    ) {
    }

    public record PasswordResetRequest(
            String password
    ) {
    }

    public record UserResponse(
            Long id,
            String username,
            String role,
            boolean enabled,
            String plantCode,
            Set<String> plantCodes,
            Set<String> modules,
            UUID driverId,
            boolean warehouseAccess
    ) {
    }
}