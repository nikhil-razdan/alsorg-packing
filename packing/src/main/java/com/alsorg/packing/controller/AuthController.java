package com.alsorg.packing.controller;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.security.JwtAuthenticationFilter;
import com.alsorg.packing.security.JwtUtil;
import com.alsorg.packing.security.LoginAttemptService;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log =
            LoggerFactory.getLogger(
                    AuthController.class);

    private static final int MAX_USERNAME_LENGTH = 180;
    private static final int MAX_PASSWORD_LENGTH = 512;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LoginAttemptService loginAttemptService;

    private final String dummyPasswordHash;
    private final boolean forceSecureCookie;
    private final String cookieSameSite;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            LoginAttemptService loginAttemptService,
            @Value("${app.security.cookie-secure:false}") boolean forceSecureCookie,
            @Value("${app.security.cookie-same-site:Lax}") String cookieSameSite) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.loginAttemptService = loginAttemptService;
        this.forceSecureCookie = forceSecureCookie;
        this.cookieSameSite = normalizeSameSite(
                cookieSameSite);

        /*
         * Used to make an unknown username perform one password-hash check too.
         * This reduces username-enumeration information from response timing.
         */
        this.dummyPasswordHash = passwordEncoder.encode(
                "FlowSuite-Dummy-"
                        + UUID.randomUUID());
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody(required = false) LoginRequest request,
            @RequestHeader(
                    value = "X-Client-Type",
                    required = false)
            String clientType,
            HttpServletRequest httpRequest) {

        String username = clean(
                request == null
                        ? null
                        : request.username());

        String password = request == null
                ? null
                : request.password();

        String clientIp = resolveClientIp(
                httpRequest);

        LoginAttemptService.Decision decision =
                loginAttemptService.checkAllowed(
                        clientIp,
                        username);

        if (!decision.allowed()) {

            log.warn(
                    "Blocked login attempt: ip={}, username={}",
                    safeLogValue(clientIp),
                    safeLogValue(username));

            return noStore(
                    ResponseEntity
                            .status(
                                    HttpStatus.TOO_MANY_REQUESTS)
                            .header(
                                    HttpHeaders.RETRY_AFTER,
                                    String.valueOf(
                                            Math.max(
                                                    1L,
                                                    decision.retryAfterSeconds())))
                            .body(
                                    Map.of(
                                            "message",
                                            "Too many login attempts. Try again later.")));
        }

        if (username == null
                || username.isBlank()) {
            return noStore(
                    ResponseEntity
                            .badRequest()
                            .body(
                                    Map.of(
                                            "message",
                                            "Username is required")));
        }

        if (username.length() > MAX_USERNAME_LENGTH) {
            loginAttemptService.recordFailure(
                    clientIp,
                    username);

            return noStore(
                    ResponseEntity
                            .badRequest()
                            .body(
                                    Map.of(
                                            "message",
                                            "Invalid credentials")));
        }

        if (password == null
                || password.isBlank()) {
            return noStore(
                    ResponseEntity
                            .badRequest()
                            .body(
                                    Map.of(
                                            "message",
                                            "Password is required")));
        }

        if (password.length() > MAX_PASSWORD_LENGTH) {
            loginAttemptService.recordFailure(
                    clientIp,
                    username);

            return noStore(
                    ResponseEntity
                            .status(
                                    HttpStatus.UNAUTHORIZED)
                            .body(
                                    Map.of(
                                            "message",
                                            "Invalid credentials")));
        }

        Optional<User> optionalUser =
                userRepository
                        .findByUsernameIgnoreCase(
                                username);

        User user = optionalUser
                .orElse(null);

        String storedPassword = user == null
                ? dummyPasswordHash
                : user.getPassword();

        boolean passwordMatch = false;

        try {
            passwordMatch =
                    storedPassword != null
                            && passwordEncoder.matches(
                                    password,
                                    storedPassword);

        } catch (IllegalArgumentException exception) {
            /*
             * A malformed legacy password hash must not leak its format or
             * produce a 500 during login.
             */
            passwordMatch = false;
        }

        if (user == null
                || !user.isEnabled()
                || !passwordMatch) {

            loginAttemptService.recordFailure(
                    clientIp,
                    username);

            log.warn(
                    "Rejected login attempt: ip={}, username={}",
                    safeLogValue(clientIp),
                    safeLogValue(username));

            /*
             * Do not reveal whether the username exists or is disabled.
             */
            return noStore(
                    ResponseEntity
                            .status(
                                    HttpStatus.UNAUTHORIZED)
                            .body(
                                    Map.of(
                                            "message",
                                            "Invalid credentials")));
        }

        loginAttemptService.recordSuccess(
                clientIp,
                username);

        /*
         * Transparently upgrade older/lower-cost password hashes only after a
         * successful credential check. The actual password does not change, so
         * existing sessions are not revoked merely for a hash-cost upgrade.
         */
        if (passwordEncoder.upgradeEncoding(
                user.getPassword())) {

            user.setPassword(
                    passwordEncoder.encode(
                            password));

            userRepository.save(
                    user);
        }

        String token =
                jwtUtil.generateToken(
                        user.getUsername(),
                        normalizeRole(
                                user.getRole()),
                        user.getSecurityVersion());

        ResponseCookie cookie =
                buildAccessCookie(
                        token,
                        httpRequest);

        Map<String, Object> response =
                buildAuthResponse(
                        user);

        /*
         * Browser:
         * JWT stays in HttpOnly cookie.
         *
         * ShipTrack/mobile:
         * bearer token is also returned in JSON for secure native storage.
         */
        if (isMobileClient(
                clientType)) {

            response.put(
                    "token",
                    token);

            response.put(
                    "accessToken",
                    token);
        }

        return noStore(
                ResponseEntity
                        .ok()
                        .header(
                                HttpHeaders.SET_COOKIE,
                                cookie.toString())
                        .body(response));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()
                || "anonymousUser".equals(
                        authentication.getName())) {

            return noStore(
                    ResponseEntity.ok(
                            Map.of(
                                    "authenticated",
                                    false)));
        }

        Optional<User> optionalUser =
                userRepository
                        .findByUsernameIgnoreCase(
                                authentication.getName());

        if (optionalUser.isEmpty()) {

            return noStore(
                    ResponseEntity.ok(
                            Map.of(
                                    "authenticated",
                                    false)));
        }

        User user =
                optionalUser.get();

        if (!user.isEnabled()) {

            return noStore(
                    ResponseEntity
                            .status(
                                    HttpStatus.FORBIDDEN)
                            .body(
                                    Map.of(
                                            "message",
                                            "User is disabled")));
        }

        return noStore(
                ResponseEntity.ok(
                        buildAuthResponse(
                                user)));
    }

    @GetMapping("/csrf")
    public ResponseEntity<?> csrf(
            CsrfToken csrfToken) {

        /*
         * Accessing the deferred token forces CookieCsrfTokenRepository to
         * create its expected cookie when one does not already exist.
         */
        String token =
                csrfToken.getToken();

        return noStore(
                ResponseEntity.ok(
                        Map.of(
                                "token",
                                token,
                                "headerName",
                                csrfToken.getHeaderName())));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            HttpServletRequest request) {

        SecurityContextHolder
                .clearContext();

        ResponseCookie cookie =
                clearAccessCookie(
                        request);

        ResponseCookie csrfCookie =
                clearCsrfCookie(
                        request);

        return noStore(
                ResponseEntity
                        .ok()
                        .header(
                                HttpHeaders.SET_COOKIE,
                                cookie.toString(),
                                csrfCookie.toString())
                        .body(
                                Map.of(
                                        "message",
                                        "Logged out successfully")));
    }

    private Map<String, Object> buildAuthResponse(
            User user) {

        Map<String, Object> response =
                new LinkedHashMap<>();

        String role =
                normalizeRole(
                        user.getRole());

        response.put(
                "authenticated",
                true);

        response.put(
                "id",
                user.getId());

        response.put(
                "username",
                user.getUsername());

        response.put(
                "role",
                role);

        response.put(
                "roles",
                user.getEffectiveRoles());

        response.put(
                "enabled",
                user.isEnabled());

        response.put(
                "warehouseAccess",
                hasWarehouseAccess(
                        user));

        response.put(
                "plantCode",
                user.getPlantCode());

        response.put(
                "plantCodes",
                user.getEffectivePlantCodes());

        response.put(
                "driverId",
                user.getDriverId());

        response.put(
                "modules",
                user.getEffectiveModules());

        return response;
    }

    private boolean hasWarehouseAccess(
            User user) {

        if (user == null) {
            return false;
        }

        return user.isWarehouseAccess()
                || user.getEffectiveRoles()
                        .stream()
                        .map(this::normalizeRole)
                        .anyMatch(
                                role ->
                                        "ADMIN".equals(role)
                                                || "WAREHOUSE".equals(role)
                                                || "DISPATCH".equals(role));
    }

    private boolean isMobileClient(
            String clientType) {

        return clientType != null
                && "mobile".equalsIgnoreCase(
                        clientType.trim());
    }

    private ResponseCookie buildAccessCookie(
            String token,
            HttpServletRequest request) {

        boolean secure =
                forceSecureCookie
                        || isSecureRequest(
                                request);

        return ResponseCookie
                .from(
                        JwtAuthenticationFilter.ACCESS_COOKIE,
                        token)
                .httpOnly(true)
                .secure(secure)
                .sameSite(
                        secure
                                ? cookieSameSite
                                : "Lax")
                .path("/")
                .maxAge(
                        Duration.ofMillis(
                                JwtUtil.getExpiryMillis()))
                .build();
    }

    private ResponseCookie clearAccessCookie(
            HttpServletRequest request) {

        boolean secure =
                forceSecureCookie
                        || isSecureRequest(
                                request);

        return ResponseCookie
                .from(
                        JwtAuthenticationFilter.ACCESS_COOKIE,
                        "")
                .httpOnly(true)
                .secure(secure)
                .sameSite(
                        secure
                                ? cookieSameSite
                                : "Lax")
                .path("/")
                .maxAge(0)
                .build();
    }

    private ResponseCookie clearCsrfCookie(
            HttpServletRequest request) {

        boolean secure =
                forceSecureCookie
                        || isSecureRequest(
                                request);

        return ResponseCookie
                .from(
                        "XSRF-TOKEN",
                        "")
                .httpOnly(true)
                .secure(secure)
                .sameSite(
                        secure
                                ? cookieSameSite
                                : "Lax")
                .path("/")
                .maxAge(0)
                .build();
    }

    private boolean isSecureRequest(
            HttpServletRequest request) {

        String proto =
                request.getHeader(
                        "X-Forwarded-Proto");

        return request.isSecure()
                || "https".equalsIgnoreCase(
                        proto);
    }

    private String resolveClientIp(
            HttpServletRequest request) {

        if (request == null
                || request.getRemoteAddr() == null
                || request.getRemoteAddr()
                        .isBlank()) {
            return "unknown";
        }

        return request.getRemoteAddr()
                .trim();
    }

    private String normalizeRole(
            String role) {

        if (role == null
                || role.isBlank()) {
            return "";
        }

        return role
                .replaceFirst(
                        "(?i)^ROLE_",
                        "")
                .trim()
                .toUpperCase();
    }

    private String clean(
            String value) {

        if (value == null) {
            return null;
        }

        String text =
                value.trim();

        if (text.isBlank()
                || "null".equalsIgnoreCase(
                        text)
                || "undefined".equalsIgnoreCase(
                        text)) {
            return null;
        }

        return text;
    }

    private String normalizeSameSite(
            String value) {

        String clean = value == null
                ? "Lax"
                : value.trim();

        if ("None".equalsIgnoreCase(clean)) {
            return "None";
        }

        if ("Strict".equalsIgnoreCase(clean)) {
            return "Strict";
        }

        return "Lax";
    }

    private String safeLogValue(
            String value) {

        if (value == null) {
            return "-";
        }

        String clean = value
                .replace('\r', '_')
                .replace('\n', '_')
                .replace('\t', '_')
                .trim();

        if (clean.length() > 180) {
            clean = clean.substring(
                    0,
                    180);
        }

        return clean;
    }

    private <T> ResponseEntity<T> noStore(
            ResponseEntity<T> response) {

        HttpHeaders headers =
                response.getHeaders();

        /*
         * ResponseEntity headers are read-only at this point in some builders,
         * so rebuild with the original status/body and explicit cache headers.
         */
        return ResponseEntity
                .status(
                        response.getStatusCode())
                .headers(existing -> {
                    existing.putAll(headers);
                    existing.setCacheControl(
                            CacheControl.noStore());
                    existing.setPragma(
                            "no-cache");
                })
                .body(
                        response.getBody());
    }

    public record LoginRequest(
            String username,
            String password) {
    }
}
