package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.LinkedHashSet;
import java.util.Set;

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
    public User createUser(@RequestBody Map<String, Object> body) {

        return service.createUser(
                String.valueOf(body.get("username")),
                String.valueOf(body.get("password")),
                String.valueOf(body.get("role")),
                readPlantCodes(body),
                readDriverId(body)
        );
    }

    @GetMapping
    public List<User> getUsers() {
        return service.getAllUsers();
    }

    @PutMapping("/{id}")
    public User updateUser(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {

        return service.updateUser(
                id,
                String.valueOf(body.get("username")),
                String.valueOf(body.get("role")),
                readPlantCodes(body),
                readDriverId(body)
        );
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

    private Set<String> readPlantCodes(Map<String, Object> body) {
        Set<String> plants = new LinkedHashSet<>();

        Object plantCodesObj = body.get("plantCodes");

        if (plantCodesObj instanceof List<?> list) {
            for (Object item : list) {
                if (item != null && !String.valueOf(item).isBlank()) {
                    plants.add(String.valueOf(item).trim());
                }
            }
        }

        Object plantCodeObj = body.get("plantCode");

        if (plants.isEmpty()
                && plantCodeObj != null
                && !String.valueOf(plantCodeObj).isBlank()) {
            plants.add(String.valueOf(plantCodeObj).trim());
        }

        return plants;
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
}