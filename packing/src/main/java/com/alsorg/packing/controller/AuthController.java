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

        return ok(user, session);
    }

    /* ===================== SUCCESS LOGIN ===================== */

    private ResponseEntity<?> ok(User user, HttpSession session) {

        String username = user.getUsername();
        String role = user.getRole();

        boolean warehouseAccess =
                user.isWarehouseAccess()
                        || "ADMIN".equalsIgnoreCase(role)
                        || "WAREHOUSE".equalsIgnoreCase(role);

        // Session for Safari/iOS compatibility
        session.setAttribute("USER", username);
        session.setAttribute("ROLE", role);
        session.setAttribute("WAREHOUSE_ACCESS", warehouseAccess);

        // JWT token for API usage
        String token = JwtUtil.generateToken(username, role);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "username", username,
                "role", role,
                "warehouseAccess", warehouseAccess
        ));
    }

    /* ===================== CURRENT USER ===================== */

    @GetMapping("/me")
    public ResponseEntity<?> me(
            @RequestHeader(value = "Authorization", required = false) String auth,
            HttpSession session
    ) {

        String username = null;

        Object sessionUser = session.getAttribute("USER");

        if (sessionUser != null) {
            username = String.valueOf(sessionUser);
        }

        // JWT fallback
        if ((username == null || username.isBlank())
                && auth != null
                && auth.startsWith("Bearer ")) {

            String token = auth.replace("Bearer ", "").trim();
            username = JwtUtil.getUsername(token);
        }

        if (username == null || username.isBlank()) {
            return ResponseEntity.status(401).build();
        }

        Optional<User> optionalUser = userRepository.findByUsername(username);

        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).build();
        }

        User user = optionalUser.get();

        String role = user.getRole();

        boolean warehouseAccess =
                user.isWarehouseAccess()
                        || "ADMIN".equalsIgnoreCase(role)
                        || "WAREHOUSE".equalsIgnoreCase(role);

        // Keep session updated with latest DB values
        session.setAttribute("USER", user.getUsername());
        session.setAttribute("ROLE", role);
        session.setAttribute("WAREHOUSE_ACCESS", warehouseAccess);

        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "role", role,
                "warehouseAccess", warehouseAccess
        ));
    }

    /* ===================== LOGOUT ===================== */

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok().build();
    }
}