package com.alsorg.packing.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

public class JwtUtil {

    // MUST be at least 32 chars for HS256.
    private static final String SECRET =
            "ALSORG_SUPER_SECRET_2026_ALSORG_SUPER_SECRET";

    private static final long EXPIRY =
            1000L * 60L * 60L * 24L; // 24 hours

    private static final SecretKey KEY =
            Keys.hmacShaKeyFor(
                    SECRET.getBytes(StandardCharsets.UTF_8)
            );

    public static String generateToken(String username, String role) {
        String cleanRole = role == null
                ? "USER"
                : role.trim().toUpperCase();

        return Jwts.builder()
                .setSubject(username)
                .claim("role", cleanRole)
                .setIssuedAt(new Date())
                .setExpiration(
                        new Date(System.currentTimeMillis() + EXPIRY)
                )
                .signWith(KEY)
                .compact();
    }

    public static String getUsername(String token) {
        return getClaims(token).getSubject();
    }

    public static String getRole(String token) {
        return getClaims(token).get("role", String.class);
    }

    public static Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(KEY)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}