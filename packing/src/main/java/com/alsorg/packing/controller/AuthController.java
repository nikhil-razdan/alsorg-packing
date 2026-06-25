package com.alsorg.packing.controller;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.security.JwtUtil;

import jakarta.servlet.http.HttpSession;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
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
        String username = clean(body.get("username"));
        String password = body.get("password");

        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Username is required"));
        }

        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Password is required"));
        }

        Optional<User> optionalUser = userRepository.findByUsername(username);

        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Invalid credentials"));
        }

        User user = optionalUser.get();

        if (!user.isEnabled()) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "User is disabled"));
        }

        boolean passwordMatch =
                passwordEncoder.matches(password, user.getPassword());

        if (!passwordMatch) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Invalid credentials"));
        }

        return ok(user, session);
    }

    /* ===================== SUCCESS LOGIN ===================== */

    private ResponseEntity<?> ok(
            User user,
            HttpSession session
    ) {
        String username = user.getUsername();
        String role = normalizeRole(user.getRole());

        boolean warehouseAccess = hasWarehouseAccess(user);

        /*
         * Session support is kept for compatibility.
         * JWT is still the main authentication method for frontend/API.
         */
        session.setAttribute("USER", username);
        session.setAttribute("ROLE", role);
        session.setAttribute("WAREHOUSE_ACCESS", warehouseAccess);
        session.setAttribute("MODULES", user.getEffectiveModules());
        session.setAttribute("PLANT_CODES", user.getEffectivePlantCodes());

        String token = JwtUtil.generateToken(username, role);

        Map<String, Object> response = buildAuthResponse(user);
        response.put("token", token);

        return ResponseEntity.ok(response);
    }

    /* ===================== CURRENT USER ===================== */

    @GetMapping("/me")
    public ResponseEntity<?> me(
            @RequestHeader(value = "Authorization", required = false) String auth,
            HttpSession session
    ) {
        String username = null;

        /*
         * First preference: JWT token.
         * This is important because frontend API calls are token-based.
         */
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                String token = auth.replace("Bearer ", "").trim();
                username = JwtUtil.getUsername(token);
            } catch (Exception e) {
                return ResponseEntity.status(401)
                        .body(Map.of("message", "Invalid or expired token"));
            }
        }

        /*
         * Fallback: Session.
         * Kept only for compatibility.
         */
        if (username == null || username.isBlank()) {
            Object sessionUser = session.getAttribute("USER");

            if (sessionUser != null) {
                username = String.valueOf(sessionUser);
            }
        }

        if (username == null || username.isBlank()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Unauthorized"));
        }

        Optional<User> optionalUser = userRepository.findByUsername(username);

        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "User not found"));
        }

        User user = optionalUser.get();

        if (!user.isEnabled()) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "User is disabled"));
        }

        String role = normalizeRole(user.getRole());
        boolean warehouseAccess = hasWarehouseAccess(user);

        /*
         * Keep session refreshed with latest DB values.
         * This means if Admin changes modules/role/warehouse access,
         * /auth/me returns updated data after refresh/re-login.
         */
        session.setAttribute("USER", user.getUsername());
        session.setAttribute("ROLE", role);
        session.setAttribute("WAREHOUSE_ACCESS", warehouseAccess);
        session.setAttribute("MODULES", user.getEffectiveModules());
        session.setAttribute("PLANT_CODES", user.getEffectivePlantCodes());

        return ResponseEntity.ok(buildAuthResponse(user));
    }

    /* ===================== LOGOUT ===================== */

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        try {
            session.invalidate();
        } catch (Exception ignored) {
        }

        SecurityContextHolder.clearContext();

        return ResponseEntity.ok(
                Map.of("message", "Logged out successfully")
        );
    }

    /* ===================== RESPONSE BUILDER ===================== */

    private Map<String, Object> buildAuthResponse(User user) {
        Map<String, Object> response = new LinkedHashMap<>();

        String role = normalizeRole(user.getRole());
        boolean warehouseAccess = hasWarehouseAccess(user);

        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("role", role);
        response.put("enabled", user.isEnabled());

        /*
         * Very important for PackFlow warehouse access.
         */
        response.put("warehouseAccess", warehouseAccess);

        /*
         * Very important for plant-wise PackFlow access.
         */
        response.put("plantCode", user.getPlantCode());
        response.put("plantCodes", user.getEffectivePlantCodes());

        /*
         * Very important for driver login/use cases.
         */
        response.put("driverId", user.getDriverId());

        /*
         * Most important for FlowSuite ModuleHub.
         * Without this, VenFlow/BOMFlow visibility will not work.
         */
        response.put("modules", user.getEffectiveModules());

        return response;
    }

    private boolean hasWarehouseAccess(User user) {
        String role = normalizeRole(user.getRole());

        return user.isWarehouseAccess()
                || "ADMIN".equalsIgnoreCase(role)
                || "WAREHOUSE".equalsIgnoreCase(role);
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "";
        }

        return role.trim().toUpperCase();
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String text = value.trim();

        if (text.isBlank() || "null".equalsIgnoreCase(text)) {
            return null;
        }

        return text;
    }
}