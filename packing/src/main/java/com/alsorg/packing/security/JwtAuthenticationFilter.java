package com.alsorg.packing.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String ACCESS_COOKIE = "ALSORG_ACCESS";

    @Override
    protected boolean shouldNotFilter(
            HttpServletRequest request
    ) {
        String path =
                request.getServletPath();

        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }

        /*
         * Do not filter login/logout.
         *
         * Do NOT skip /api/auth/me.
         * If cookie exists, /me should authenticate.
         * If cookie does not exist, SecurityConfig permits it and controller
         * returns authenticated:false.
         */
        return path.equals("/api/auth/login")
                || path.equals("/api/auth/logout");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String token =
                resolveToken(request);

        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String username =
                    JwtUtil.getUsername(token);

            String role =
                    JwtUtil.getRole(token);

            if (
                    username != null
                            && !username.isBlank()
                            && SecurityContextHolder
                                    .getContext()
                                    .getAuthentication() == null
            ) {
                String cleanRole =
                        cleanRole(role);

                List<GrantedAuthority> authorities =
                        new ArrayList<>();

                if (cleanRole != null && !cleanRole.isBlank()) {
                    authorities.add(
                            new SimpleGrantedAuthority(cleanRole)
                    );

                    authorities.add(
                            new SimpleGrantedAuthority("ROLE_" + cleanRole)
                    );
                }

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                username,
                                null,
                                authorities
                        );

                authentication.setDetails(
                        new WebAuthenticationDetailsSource()
                                .buildDetails(request)
                );

                SecurityContextHolder
                        .getContext()
                        .setAuthentication(authentication);
            }

            filterChain.doFilter(request, response);

        } catch (ExpiredJwtException ex) {
            SecurityContextHolder.clearContext();

            if (isMeRequest(request)) {
                filterChain.doFilter(request, response);
                return;
            }

            writeUnauthorized(
                    response,
                    "Session expired. Please login again."
            );

        } catch (JwtException | IllegalArgumentException ex) {
            SecurityContextHolder.clearContext();

            if (isMeRequest(request)) {
                filterChain.doFilter(request, response);
                return;
            }

            writeUnauthorized(
                    response,
                    "Invalid session. Please login again."
            );
        }
    }

    private boolean isMeRequest(
            HttpServletRequest request
    ) {
        return "/api/auth/me".equals(
                request.getServletPath()
        );
    }

    private String resolveToken(
            HttpServletRequest request
    ) {
        /*
         * Cookie first.
         * Header fallback only for old frontend pages still using Bearer token.
         */
        String cookieToken =
                tokenFromCookie(request);

        if (cookieToken != null && !cookieToken.isBlank()) {
            return cookieToken;
        }

        String header =
                request.getHeader("Authorization");

        if (header == null || header.isBlank()) {
            return null;
        }

        if (!header.startsWith("Bearer ")) {
            return null;
        }

        String token =
                header.substring(7).trim();

        if (
                token.isBlank()
                        || token.equalsIgnoreCase("null")
                        || token.equalsIgnoreCase("undefined")
        ) {
            return null;
        }

        return token;
    }

    private String tokenFromCookie(
            HttpServletRequest request
    ) {
        Cookie[] cookies =
                request.getCookies();

        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (ACCESS_COOKIE.equals(cookie.getName())) {
                String value =
                        cookie.getValue();

                if (
                        value != null
                                && !value.isBlank()
                                && !value.equalsIgnoreCase("null")
                                && !value.equalsIgnoreCase("undefined")
                ) {
                    return value.trim();
                }
            }
        }

        return null;
    }

    private String cleanRole(
            String role
    ) {
        if (role == null) {
            return null;
        }

        return role
                .replace("ROLE_", "")
                .trim()
                .toUpperCase();
    }

    private void writeUnauthorized(
            HttpServletResponse response,
            String message
    ) throws IOException {
        if (response.isCommitted()) {
            return;
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        response.getWriter()
                .write("{\"message\":\"" + message + "\"}");
    }
}