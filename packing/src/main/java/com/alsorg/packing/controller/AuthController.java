package com.alsorg.packing.controller;

import com.alsorg.packing.security.JwtUtil;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

import jakarta.servlet.http.HttpSession;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /* ===================== LOGIN ===================== */

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody Map<String, String> body,
            HttpSession session
    ) {

        String username = body.get("username");
        String password = body.get("password");

        Optional<User> optionalUser = userRepository.findByUsername(username);

        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Invalid credentials"));
        }

        User user = optionalUser.get();

        boolean passwordMatch =
                passwordEncoder.matches(password, user.getPassword());

        if (!passwordMatch) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Invalid credentials"));
        }

        return ok(user.getUsername(), user.getRole(), session);
    }

    /* ===================== SUCCESS LOGIN ===================== */

    private ResponseEntity<?> ok(String username, String role, HttpSession session) {

        // Session for Safari/iOS compatibility
        session.setAttribute("USER", username);
        session.setAttribute("ROLE", role);

        // JWT token for API usage
        String token = JwtUtil.generateToken(username, role);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "role", role
        ));
    }

    /* ===================== CURRENT USER ===================== */

    @GetMapping("/me")
    public ResponseEntity<?> me(
            @RequestHeader(value = "Authorization", required = false) String auth,
            HttpSession session
    ) {

        Object user = session.getAttribute("USER");
        Object role = session.getAttribute("ROLE");

        if (user != null && role != null) {
            return ResponseEntity.ok(Map.of(
                    "username", user,
                    "role", role
            ));
        }

        // JWT fallback
        if (auth != null && auth.startsWith("Bearer ")) {

            String token = auth.replace("Bearer ", "");

            return ResponseEntity.ok(Map.of(
                    "username", JwtUtil.getUsername(token),
                    "role", JwtUtil.getRole(token)
            ));
        }

        return ResponseEntity.status(401).build();
    }

    /* ===================== LOGOUT ===================== */

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok().build();
    }
}