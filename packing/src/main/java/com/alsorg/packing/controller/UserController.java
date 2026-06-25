package com.alsorg.packing.controller;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService service;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(
            UserService service,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.service = service;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping
    public UserResponse createUser(@RequestBody Map<String, Object> body) {
        User user = service.createUser(
                readText(body, "username"),
                readText(body, "password"),
                readText(body, "role"),
                readPlantCodes(body),
                readDriverId(body),
                readBoolean(body, "warehouseAccess"),
                readModules(body)
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
            @RequestBody Map<String, Object> body
    ) {
        User user = service.updateUser(
                id,
                readText(body, "username"),
                readText(body, "role"),
                readPlantCodes(body),
                readDriverId(body),
                readBoolean(body, "warehouseAccess"),
                readModules(body)
        );

        return toResponse(user);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        service.deleteUser(id);

        return ResponseEntity.ok(
                Map.of("message", "User deleted")
        );
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> updatePassword(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        Optional<User> optionalUser = userRepository.findById(id);

        if (optionalUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        String newPassword = body.get("password");

        if (newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Password cannot be empty"));
        }

        User user = optionalUser.get();

        user.setPassword(passwordEncoder.encode(newPassword));

        userRepository.save(user);

        return ResponseEntity.ok(
                Map.of("message", "Password updated successfully")
        );
    }

    private UserResponse toResponse(User user) {
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

    private String readText(Map<String, Object> body, String key) {
        Object value = body.get(key);

        if (value == null) {
            return null;
        }

        String text = String.valueOf(value).trim();

        if (text.isBlank() || "null".equalsIgnoreCase(text)) {
            return null;
        }

        return text;
    }

    private Set<String> readPlantCodes(Map<String, Object> body) {
        Set<String> plants = new LinkedHashSet<>();

        Object plantCodesObj = body.get("plantCodes");

        if (plantCodesObj instanceof List<?> list) {
            for (Object item : list) {
                addCsvValues(plants, item);
            }
        } else {
            addCsvValues(plants, plantCodesObj);
        }

        Object plantCodeObj = body.get("plantCode");

        if (plants.isEmpty()) {
            addCsvValues(plants, plantCodeObj);
        }

        return plants;
    }

    private Set<String> readModules(Map<String, Object> body) {
        Set<String> modules = new LinkedHashSet<>();

        Object modulesObj = body.get("modules");

        if (modulesObj instanceof List<?> list) {
            for (Object item : list) {
                addCsvValues(modules, item);
            }
        } else {
            addCsvValues(modules, modulesObj);
        }

        Object moduleObj = body.get("module");

        if (modules.isEmpty()) {
            addCsvValues(modules, moduleObj);
        }

        return modules;
    }

    private void addCsvValues(Set<String> target, Object value) {
        if (value == null) {
            return;
        }

        String text = String.valueOf(value).trim();

        if (text.isBlank() || "null".equalsIgnoreCase(text)) {
            return;
        }

        String[] parts = text.split(",");

        for (String part : parts) {
            String clean = part == null ? "" : part.trim();

            if (!clean.isBlank()) {
                target.add(clean);
            }
        }
    }

    private UUID readDriverId(Map<String, Object> body) {
        Object driverIdObj = body.get("driverId");

        if (driverIdObj == null) {
            return null;
        }

        String text = String.valueOf(driverIdObj).trim();

        if (text.isBlank() || "null".equalsIgnoreCase(text)) {
            return null;
        }

        try {
            return UUID.fromString(text);
        } catch (Exception e) {
            throw new RuntimeException("Invalid driverId: " + text);
        }
    }

    private boolean readBoolean(Map<String, Object> body, String key) {
        Object value = body.get(key);

        if (value == null) {
            return false;
        }

        if (value instanceof Boolean b) {
            return b;
        }

        String text = String.valueOf(value).trim();

        return "true".equalsIgnoreCase(text)
                || "1".equals(text)
                || "yes".equalsIgnoreCase(text);
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