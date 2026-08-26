package com.alsorg.packing.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Component
public class JwtUtil {

    private static final long MIN_EXPIRY_MILLIS = 5L * 60L * 1000L;
    private static final long MAX_EXPIRY_MILLIS = 24L * 60L * 60L * 1000L;

    private static final Set<String> FORBIDDEN_SECRETS = Set.of(
            "changeme",
            "change-me",
            "password",
            "secret",
            "jwt-secret");

    private static SecretKey KEY;
    private static long EXPIRY_MILLIS;
    private static long CLOCK_SKEW_SECONDS;
    private static String ISSUER;
    private static String AUDIENCE;
    private static boolean ACCEPT_LEGACY_TOKENS;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiry-ms:28800000}") long expiryMillis,
            @Value("${app.jwt.clock-skew-seconds:30}") long clockSkewSeconds,
            @Value("${app.jwt.issuer:flowsuite}") String issuer,
            @Value("${app.jwt.audience:flowsuite-clients}") String audience,
            @Value("${app.jwt.accept-legacy-tokens:true}") boolean acceptLegacyTokens) {

        String cleanSecret = secret == null
                ? null
                : secret.trim();

        if (cleanSecret == null
                || cleanSecret.length() < 32) {
            throw new IllegalArgumentException(
                    "app.jwt.secret must be at least 32 characters");
        }

        if (FORBIDDEN_SECRETS.contains(
                cleanSecret.toLowerCase(
                        Locale.ROOT))) {
            throw new IllegalArgumentException(
                    "app.jwt.secret uses an unsafe placeholder value");
        }

        if (expiryMillis < MIN_EXPIRY_MILLIS
                || expiryMillis > MAX_EXPIRY_MILLIS) {
            throw new IllegalArgumentException(
                    "app.jwt.expiry-ms must be between 5 minutes and 24 hours");
        }

        String cleanIssuer = requireText(
                issuer,
                "app.jwt.issuer");

        String cleanAudience = requireText(
                audience,
                "app.jwt.audience");

        KEY = Keys.hmacShaKeyFor(
                cleanSecret.getBytes(
                        StandardCharsets.UTF_8));

        EXPIRY_MILLIS = expiryMillis;
        CLOCK_SKEW_SECONDS = Math.max(
                0L,
                Math.min(
                        300L,
                        clockSkewSeconds));

        ISSUER = cleanIssuer;
        AUDIENCE = cleanAudience;
        ACCEPT_LEGACY_TOKENS = acceptLegacyTokens;
    }

    public static String generateToken(
            String username,
            String role) {

        return generateToken(
                username,
                role,
                0L);
    }

    public static String generateToken(
            String username,
            String role,
            long securityVersion) {

        ensureKeyReady();

        String cleanUsername = requireText(
                username,
                "username");

        String cleanRole = role == null
                ? "USER"
                : role
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        long safeSecurityVersion =
                Math.max(
                        0L,
                        securityVersion);

        Instant now = Instant.now();

        return Jwts.builder()
                .subject(cleanUsername)
                .claim("role", cleanRole)
                .claim("sv", safeSecurityVersion)
                .issuer(ISSUER)
                .audience()
                        .add(AUDIENCE)
                        .and()
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(
                        Date.from(
                                now.plusMillis(
                                        EXPIRY_MILLIS)))
                .signWith(KEY)
                .compact();
    }

    public static String getUsername(
            String token) {

        String cleanToken =
                cleanToken(token);

        if (cleanToken == null
                || cleanToken.isBlank()) {
            return usernameFromSecurityContext();
        }

        return getClaims(cleanToken)
                .getSubject();
    }

    public static String getRole(
            String token) {

        String cleanToken =
                cleanToken(token);

        if (cleanToken == null
                || cleanToken.isBlank()) {
            return roleFromSecurityContext();
        }

        return getClaims(cleanToken)
                .get(
                        "role",
                        String.class);
    }

    public static Claims getClaims(
            String token) {

        ensureKeyReady();

        String cleanToken =
                cleanToken(token);

        if (cleanToken == null
                || cleanToken.isBlank()) {
            throw new IllegalArgumentException(
                    "JWT token is missing");
        }

        Claims claims =
                Jwts.parser()
                        .verifyWith(KEY)
                        .clockSkewSeconds(
                                CLOCK_SKEW_SECONDS)
                        .build()
                        .parseSignedClaims(
                                cleanToken)
                        .getPayload();

        if (claims.getSubject() == null
                || claims.getSubject().isBlank()
                || claims.getIssuedAt() == null
                || claims.getExpiration() == null) {

            throw new IllegalArgumentException(
                    "JWT required claims are missing");
        }

        boolean hardenedToken =
                hasText(claims.getIssuer())
                        || claims.get("aud") != null
                        || hasText(claims.getId())
                        || claims.get("sv") != null;

        if (!hardenedToken) {
            if (!ACCEPT_LEGACY_TOKENS) {
                throw new IllegalArgumentException(
                        "Legacy JWT is no longer accepted");
            }

            /*
             * Migration-only compatibility for JWTs issued by the pre-hardening
             * FlowSuite backend. Signature, expiration, subject and issued-at are
             * still verified. New tokens always use issuer/audience/jti/sv.
             */
            return claims;
        }

        if (!ISSUER.equals(
                claims.getIssuer())) {
            throw new IllegalArgumentException(
                    "JWT issuer is invalid");
        }

        if (!audienceContains(
                claims.get("aud"),
                AUDIENCE)) {
            throw new IllegalArgumentException(
                    "JWT audience is invalid");
        }

        if (!hasText(
                claims.getId())) {
            throw new IllegalArgumentException(
                    "JWT id is missing");
        }

        return claims;
    }

    public static long getSecurityVersion(
            Claims claims) {

        if (claims == null) {
            return 0L;
        }

        Object value =
                claims.get("sv");

        if (value instanceof Number number) {
            return Math.max(
                    0L,
                    number.longValue());
        }

        if (value instanceof String text) {
            try {
                return Math.max(
                        0L,
                        Long.parseLong(
                                text.trim()));
            } catch (NumberFormatException ignored) {
                return 0L;
            }
        }

        /*
         * Backward compatibility:
         * tokens issued before security-version support are version 0.
         */
        return 0L;
    }

    public static long getSecurityVersion(
            String token) {

        return getSecurityVersion(
                getClaims(token));
    }

    public static long getExpiryMillis() {
        ensureKeyReady();
        return EXPIRY_MILLIS;
    }

    private static String cleanToken(
            String token) {

        if (token == null) {
            return null;
        }

        String clean =
                token.trim();

        if (clean.isBlank()) {
            return null;
        }

        if (clean.regionMatches(
                true,
                0,
                "Bearer ",
                0,
                7)) {

            clean = clean
                    .substring(7)
                    .trim();
        }

        return clean;
    }

    private static String usernameFromSecurityContext() {

        Authentication auth =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (auth == null
                || !auth.isAuthenticated()
                || auth.getName() == null
                || auth.getName().isBlank()
                || "anonymousUser".equals(
                        auth.getName())) {
            return null;
        }

        return auth.getName();
    }

    private static String roleFromSecurityContext() {

        Authentication auth =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (auth == null
                || !auth.isAuthenticated()
                || auth.getAuthorities() == null
                || auth.getAuthorities().isEmpty()) {
            return null;
        }

        return auth.getAuthorities()
                .stream()
                .map(authority ->
                        authority.getAuthority())
                .filter(value ->
                        value != null
                                && !value.isBlank())
                .map(value ->
                        value.replaceFirst(
                                "(?i)^ROLE_",
                                ""))
                .map(value ->
                        value.trim()
                                .toUpperCase(
                                        Locale.ROOT))
                .findFirst()
                .orElse(null);
    }

    private static boolean audienceContains(
            Object audienceClaim,
            String expectedAudience) {

        if (audienceClaim == null
                || expectedAudience == null) {
            return false;
        }

        if (audienceClaim instanceof String text) {
            return expectedAudience.equals(
                    text.trim());
        }

        if (audienceClaim instanceof Iterable<?> values) {
            for (Object value : values) {
                if (value != null
                        && expectedAudience.equals(
                                value.toString().trim())) {
                    return true;
                }
            }
        }

        return false;
    }

    private static boolean hasText(
            String value) {

        return value != null
                && !value.trim().isBlank();
    }

    private static String requireText(
            String value,
            String label) {

        if (value == null
                || value.trim().isBlank()) {
            throw new IllegalArgumentException(
                    label + " is required");
        }

        return value.trim();
    }

    private static void ensureKeyReady() {

        if (KEY == null) {
            throw new IllegalStateException(
                    "JWT key is not initialized. Check app.jwt.secret / JWT_SECRET.");
        }
    }
}
