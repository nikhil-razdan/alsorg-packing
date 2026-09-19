package com.alsorg.packing.controller;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.UserService;

/**
 * FlowSuite user management + one narrow MatFlow designer-directory lookup.
 *
 * User administration stays on /api/users and remains ADMIN-only.
 * MatFlow never receives the complete user directory; it can only request the
 * enabled Junior Designer identities eligible for the selected plant.
 */
@RestController
@RequestMapping("/api")
@PreAuthorize("isAuthenticated()")
public class UserController {

    private final UserService service;
    private final CurrentUserService currentUserService;

    public UserController(
            UserService service,
            CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/users")
    @PreAuthorize("hasAuthority('ADMIN')")
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

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('ADMIN')")
    public List<UserResponse> getUsers() {
        return service.getAllUsers()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * MatFlow Design Head/Manager lookup used by the Junior Designer dropdown.
     *
     * The response is deliberately minimal and is resolved from the canonical
     * FlowSuite User table through UserService. No second designer directory is
     * created and no password/role/module metadata is exposed to Design users.
     */
    @GetMapping("/matflow/users/junior-designers")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER','MATFLOW_DESIGN_HEAD')")
    public List<MatFlowJuniorDesignerResponse> getMatFlowJuniorDesigners(
            @RequestParam String plantCode) {

        String plant = plantCode == null
                ? ""
                : plantCode.trim().toUpperCase(Locale.ROOT);

        if (plant.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant code is required for Junior Designer lookup");
        }

        User actor = currentUserService.requireCurrentUser();

        if (!currentUserService.isAdmin(actor)
                && !currentUserService.hasModule(actor, "MATFLOW")) {
            throw new AccessDeniedException(
                    "MatFlow module access required");
        }

        if (!currentUserService.canAccessPlant(actor, plant)) {
            throw new AccessDeniedException(
                    "No access to plant: " + plant);
        }

        return service.getMatFlowJuniorDesigners(plant)
                .stream()
                .map(user -> new MatFlowJuniorDesignerResponse(
                        user.getId(),
                        user.getUsername()))
                .toList();
    }

    @PutMapping("/users/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
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

    @DeleteMapping("/users/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Map<String, String>> disableUser(
            @PathVariable Long id) {
        service.disableUser(id);
        return ResponseEntity.ok(Map.of("message", "User disabled"));
    }

    @PutMapping("/users/{id}/password")
    @PreAuthorize("hasAuthority('ADMIN')")
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

    @PutMapping("/users/{id}/revoke-sessions")
    @PreAuthorize("hasAuthority('ADMIN')")
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

    public record MatFlowJuniorDesignerResponse(
            Long id,
            String username) {
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
