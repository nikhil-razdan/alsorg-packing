package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    /* ================= CREATE USER ================= */

    @PostMapping
    public User createUser(@RequestBody Map<String,String> body) {

        return service.createUser(
                body.get("username"),
                body.get("password"),
                body.get("role")
        );
    }

    /* ================= GET USERS ================= */

    @GetMapping
    public List<User> getUsers() {
        return service.getAllUsers();
    }

    /* ================= UPDATE USER ================= */

    @PutMapping("/{id}")
    public User updateUser(
            @PathVariable Long id,
            @RequestBody Map<String,String> body
    ) {

        return service.updateUser(
                id,
                body.get("username"),
                body.get("role")
        );
    }

    /* ================= DELETE USER ================= */

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {

        service.deleteUser(id);

        return ResponseEntity.ok(
                Map.of("message","User deleted")
        );
    }

    /* ================= RESET PASSWORD ================= */

    @PutMapping("/{id}/password")
    public ResponseEntity<?> updatePassword(
            @PathVariable Long id,
            @RequestBody Map<String,String> body
    ) {

        Optional<User> optionalUser = userRepository.findById(id);

        if(optionalUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        String newPassword = body.get("password");

        if(newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message","Password cannot be empty"));
        }

        User user = optionalUser.get();

        user.setPassword(passwordEncoder.encode(newPassword));

        userRepository.save(user);

        return ResponseEntity.ok(
                Map.of("message","Password updated successfully")
        );
    }

}