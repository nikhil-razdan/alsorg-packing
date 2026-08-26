package com.alsorg.packing.security;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter
        extends OncePerRequestFilter {

    public static final String ACCESS_COOKIE = "ALSORG_ACCESS";

    private static final int MAX_JWT_LENGTH = 8192;

    private final UserRepository userRepository;

    public JwtAuthenticationFilter(
            UserRepository userRepository) {

        this.userRepository =
                userRepository;
    }

    @Override
    protected boolean shouldNotFilter(
            HttpServletRequest request) {

        String path =
                request.getServletPath();

        if (HttpMethod.OPTIONS.matches(
                request.getMethod())) {
            return true;
        }

        return "/api/auth/login".equals(path)
                || "/api/auth/logout".equals(path)
                || "/api/auth/csrf".equals(path);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        String token =
                resolveToken(request);

        if (token == null
                || token.isBlank()) {

            filterChain.doFilter(
                    request,
                    response);

            return;
        }

        if (token.length() > MAX_JWT_LENGTH) {
            SecurityContextHolder.clearContext();

            writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Invalid session");

            return;
        }

        try {
            Claims claims =
                    JwtUtil.getClaims(
                            token);

            String username =
                    claims.getSubject();

            long tokenSecurityVersion =
                    JwtUtil.getSecurityVersion(
                            claims);

            if (username == null
                    || username.isBlank()) {

                handleInvalidUser(
                        request,
                        response,
                        filterChain);

                return;
            }

            User user = userRepository
                    .findByUsernameIgnoreCase(
                            username)
                    .orElse(null);

            if (user == null) {
                handleInvalidUser(
                        request,
                        response,
                        filterChain);

                return;
            }

            if (!user.isEnabled()) {
                SecurityContextHolder
                        .clearContext();

                if (isMeRequest(request)) {
                    filterChain.doFilter(
                            request,
                            response);

                    return;
                }

                writeJsonError(
                        response,
                        HttpServletResponse.SC_UNAUTHORIZED,
                        "Session is no longer valid. Please login again.");

                return;
            }

            if (tokenSecurityVersion
                    != user.getSecurityVersion()) {

                SecurityContextHolder
                        .clearContext();

                if (isMeRequest(request)) {
                    filterChain.doFilter(
                            request,
                            response);

                    return;
                }

                writeJsonError(
                        response,
                        HttpServletResponse.SC_UNAUTHORIZED,
                        "Session is no longer valid. Please login again.");

                return;
            }

            if (SecurityContextHolder
                    .getContext()
                    .getAuthentication() == null) {

                Set<GrantedAuthority> authorities =
                        new LinkedHashSet<>();

                for (String assignedRole :
                        user.getEffectiveRoles()) {

                    String cleanAssignedRole =
                            cleanRole(
                                    assignedRole);

                    if (cleanAssignedRole == null
                            || cleanAssignedRole.isBlank()) {
                        continue;
                    }

                    authorities.add(
                            new SimpleGrantedAuthority(
                                    cleanAssignedRole));

                    authorities.add(
                            new SimpleGrantedAuthority(
                                    "ROLE_"
                                            + cleanAssignedRole));
                }

                if (authorities.isEmpty()) {
                    SecurityContextHolder
                            .clearContext();

                    writeJsonError(
                            response,
                            HttpServletResponse.SC_FORBIDDEN,
                            "No application role is assigned");

                    return;
                }

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                user.getUsername(),
                                null,
                                authorities);

                authentication.setDetails(
                        new WebAuthenticationDetailsSource()
                                .buildDetails(
                                        request));

                SecurityContextHolder
                        .getContext()
                        .setAuthentication(
                                authentication);
            }

            filterChain.doFilter(
                    request,
                    response);

        } catch (ExpiredJwtException ex) {
            SecurityContextHolder
                    .clearContext();

            if (isMeRequest(request)) {
                filterChain.doFilter(
                        request,
                        response);

                return;
            }

            writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Session expired. Please login again.");

        } catch (JwtException
                | IllegalArgumentException ex) {

            SecurityContextHolder
                    .clearContext();

            if (isMeRequest(request)) {
                filterChain.doFilter(
                        request,
                        response);

                return;
            }

            writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Invalid session. Please login again.");
        }
    }

    private void handleInvalidUser(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws IOException, ServletException {

        SecurityContextHolder
                .clearContext();

        if (isMeRequest(request)) {
            filterChain.doFilter(
                    request,
                    response);

            return;
        }

        writeJsonError(
                response,
                HttpServletResponse.SC_UNAUTHORIZED,
                "Invalid user session");
    }

    private boolean isMeRequest(
            HttpServletRequest request) {

        return "/api/auth/me".equals(
                request.getServletPath());
    }

    private String resolveToken(
            HttpServletRequest request) {

        String cookieToken =
                tokenFromCookie(
                        request);

        if (cookieToken != null
                && !cookieToken.isBlank()) {
            return cookieToken;
        }

        String header =
                request.getHeader(
                        "Authorization");

        if (header == null
                || header.isBlank()
                || !header.regionMatches(
                        true,
                        0,
                        "Bearer ",
                        0,
                        7)) {
            return null;
        }

        String token =
                header.substring(7)
                        .trim();

        if (token.isBlank()
                || "null".equalsIgnoreCase(
                        token)
                || "undefined".equalsIgnoreCase(
                        token)) {
            return null;
        }

        return token;
    }

    private String tokenFromCookie(
            HttpServletRequest request) {

        Cookie[] cookies =
                request.getCookies();

        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (cookie == null
                    || !ACCESS_COOKIE.equals(
                            cookie.getName())) {
                continue;
            }

            String value =
                    cookie.getValue();

            if (value != null
                    && !value.isBlank()
                    && !"null".equalsIgnoreCase(
                            value)
                    && !"undefined".equalsIgnoreCase(
                            value)) {
                return value.trim();
            }
        }

        return null;
    }

    private String cleanRole(
            String role) {

        if (role == null) {
            return null;
        }

        return role
                .replaceFirst(
                        "(?i)^ROLE_",
                        "")
                .trim()
                .toUpperCase();
    }

    private void writeJsonError(
            HttpServletResponse response,
            int status,
            String message)
            throws IOException {

        if (response.isCommitted()) {
            return;
        }

        response.setStatus(status);
        response.setContentType(
                "application/json");
        response.setCharacterEncoding(
                "UTF-8");

        response.getWriter()
                .write(
                        "{\"message\":\""
                                + escapeJson(
                                        message)
                                + "\"}");
    }

    private String escapeJson(
            String value) {

        if (value == null) {
            return "";
        }

        return value
                .replace(
                        "\\",
                        "\\\\")
                .replace(
                        "\"",
                        "\\\"");
    }
}
