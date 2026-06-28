package com.alsorg.packing.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expiryMillis;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiry-ms:28800000}") long expiryMillis
    ) {
        if (secret == null || secret.trim().length() < 32) {
            throw new IllegalArgumentException(
                    "app.jwt.secret must be at least 32 characters"
            );
        }

        this.key = Keys.hmacShaKeyFor(
                secret.getBytes(StandardCharsets.UTF_8)
        );

        this.expiryMillis = expiryMillis;
    }

    public String generateToken(
            String username,
            String role
    ) {
        String cleanRole = role == null
                ? "USER"
                : role.trim().toUpperCase();

        Instant now = Instant.now();

        return Jwts.builder()
                .setSubject(username)
                .claim("role", cleanRole)
                .setIssuedAt(Date.from(now))
                .setExpiration(
                        Date.from(now.plusMillis(expiryMillis))
                )
                .signWith(key)
                .compact();
    }

    public String getUsername(String token) {
        return getClaims(token).getSubject();
    }

    public String getRole(String token) {
        return getClaims(token).get("role", String.class);
    }

    public Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}