package com.alsorg.packing.controller;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.security.JwtAuthenticationFilter;
import com.alsorg.packing.security.JwtUtil;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String username = clean(request.username());
        String password = request.password();

        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Username is required"));
        }

        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Password is required"));
        }

        Optional<User> optionalUser =
                userRepository.findByUsernameIgnoreCase(username);

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
                passwordEncoder.matches(
                        password,
                        user.getPassword()
                );

        if (!passwordMatch) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Invalid credentials"));
        }

        String token =
                jwtUtil.generateToken(
                        user.getUsername(),
                        normalizeRole(user.getRole())
                );

        ResponseCookie cookie =
                buildAccessCookie(
                        token,
                        httpRequest
                );

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        cookie.toString()
                )
                .body(buildAuthResponse(user));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                authentication == null
                        || !authentication.isAuthenticated()
                        || authentication.getName() == null
                        || authentication.getName().isBlank()
                        || "anonymousUser".equals(authentication.getName())
        ) {
            return ResponseEntity.ok(
                    Map.of(
                            "authenticated",
                            false
                    )
            );
        }

        Optional<User> optionalUser =
                userRepository.findByUsernameIgnoreCase(
                        authentication.getName()
                );

        if (optionalUser.isEmpty()) {
            return ResponseEntity.ok(
                    Map.of(
                            "authenticated",
                            false
                    )
            );
        }

        User user =
                optionalUser.get();

        if (!user.isEnabled()) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "User is disabled"));
        }

        return ResponseEntity.ok(
                buildAuthResponse(user)
        );
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            HttpServletRequest request
    ) {
        SecurityContextHolder.clearContext();

        ResponseCookie cookie =
                clearAccessCookie(request);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        cookie.toString()
                )
                .body(Map.of("message", "Logged out successfully"));
    }

    private Map<String, Object> buildAuthResponse(
            User user
    ) {
        Map<String, Object> response =
                new LinkedHashMap<>();

        String role =
                normalizeRole(user.getRole());

        response.put("authenticated", true);
        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("role", role);
        response.put("enabled", user.isEnabled());

        response.put(
                "warehouseAccess",
                hasWarehouseAccess(user)
        );

        response.put(
                "plantCode",
                user.getPlantCode()
        );

        response.put(
                "plantCodes",
                user.getEffectivePlantCodes()
        );

        response.put(
                "driverId",
                user.getDriverId()
        );

        response.put(
                "modules",
                user.getEffectiveModules()
        );

        return response;
    }

    private boolean hasWarehouseAccess(
            User user
    ) {
        String role =
                normalizeRole(user.getRole());

        return user.isWarehouseAccess()
                || "ADMIN".equals(role)
                || "WAREHOUSE".equals(role);
    }

    private ResponseCookie buildAccessCookie(
            String token,
            HttpServletRequest request
    ) {
        boolean secure =
                isSecureRequest(request);

        return ResponseCookie
                .from(
                        JwtAuthenticationFilter.ACCESS_COOKIE,
                        token
                )
                .httpOnly(true)
                .secure(secure)
                .sameSite(secure ? "None" : "Lax")
                .path("/")
                .maxAge(Duration.ofHours(8))
                .build();
    }

    private ResponseCookie clearAccessCookie(
            HttpServletRequest request
    ) {
        boolean secure =
                isSecureRequest(request);

        return ResponseCookie
                .from(
                        JwtAuthenticationFilter.ACCESS_COOKIE,
                        ""
                )
                .httpOnly(true)
                .secure(secure)
                .sameSite(secure ? "None" : "Lax")
                .path("/")
                .maxAge(0)
                .build();
    }

    private boolean isSecureRequest(
            HttpServletRequest request
    ) {
        String proto =
                request.getHeader("X-Forwarded-Proto");

        return request.isSecure()
                || "https".equalsIgnoreCase(proto);
    }

    private String normalizeRole(
            String role
    ) {
        if (role == null || role.isBlank()) {
            return "";
        }

        return role
                .replace("ROLE_", "")
                .trim()
                .toUpperCase();
    }

    private String clean(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String text =
                value.trim();

        if (
                text.isBlank()
                        || "null".equalsIgnoreCase(text)
                        || "undefined".equalsIgnoreCase(text)
        ) {
            return null;
        }

        return text;
    }

    public record LoginRequest(
            String username,
            String password
    ) {
    }
}