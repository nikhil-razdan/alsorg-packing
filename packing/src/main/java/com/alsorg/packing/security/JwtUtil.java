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

@Component
public class JwtUtil {

    private static SecretKey KEY;
    private static long EXPIRY_MILLIS;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiry-ms:28800000}") long expiryMillis
    ) {
        if (secret == null || secret.trim().length() < 32) {
            throw new IllegalArgumentException(
                    "app.jwt.secret must be at least 32 characters"
            );
        }

        KEY = Keys.hmacShaKeyFor(
                secret.getBytes(StandardCharsets.UTF_8)
        );

        EXPIRY_MILLIS = expiryMillis;
    }

    public static String generateToken(
            String username,
            String role
    ) {
        ensureKeyReady();

        String cleanRole = role == null
                ? "USER"
                : role.trim().toUpperCase();

        Instant now = Instant.now();

        return Jwts.builder()
                .setSubject(username)
                .claim("role", cleanRole)
                .setIssuedAt(Date.from(now))
                .setExpiration(
                        Date.from(now.plusMillis(EXPIRY_MILLIS))
                )
                .signWith(KEY)
                .compact();
    }

    public static String getUsername(
            String token
    ) {
        String cleanToken =
                cleanToken(token);

        if (cleanToken == null || cleanToken.isBlank()) {
            return usernameFromSecurityContext();
        }

        return getClaims(cleanToken)
                .getSubject();
    }

    public static String getRole(
            String token
    ) {
        String cleanToken =
                cleanToken(token);

        if (cleanToken == null || cleanToken.isBlank()) {
            return roleFromSecurityContext();
        }

        return getClaims(cleanToken)
                .get("role", String.class);
    }

    public static Claims getClaims(
            String token
    ) {
        ensureKeyReady();

        String cleanToken =
                cleanToken(token);

        if (cleanToken == null || cleanToken.isBlank()) {
            throw new RuntimeException("JWT token is missing");
        }

        return Jwts.parserBuilder()
                .setSigningKey(KEY)
                .build()
                .parseClaimsJws(cleanToken)
                .getBody();
    }

    private static String cleanToken(
            String token
    ) {
        if (token == null) {
            return null;
        }

        String clean =
                token.trim();

        if (clean.isBlank()) {
            return null;
        }

        if (clean.startsWith("Bearer ")) {
            clean =
                    clean.substring(7).trim();
        }

        return clean;
    }

    private static String usernameFromSecurityContext() {
        Authentication auth =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                auth == null
                        || !auth.isAuthenticated()
                        || auth.getName() == null
                        || auth.getName().isBlank()
        ) {
            return null;
        }

        return auth.getName();
    }

    private static String roleFromSecurityContext() {
        Authentication auth =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                auth == null
                        || !auth.isAuthenticated()
                        || auth.getAuthorities() == null
                        || auth.getAuthorities().isEmpty()
        ) {
            return null;
        }

        return auth.getAuthorities()
                .iterator()
                .next()
                .getAuthority()
                .replace("ROLE_", "")
                .trim()
                .toUpperCase();
    }

    private static void ensureKeyReady() {
        if (KEY == null) {
            throw new IllegalStateException(
                    "JWT key is not initialized. Check app.jwt.secret / JWT_SECRET."
            );
        }
    }
}