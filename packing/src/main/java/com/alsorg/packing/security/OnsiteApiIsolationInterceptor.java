package com.alsorg.packing.security;

import java.io.IOException;
import java.util.Locale;

import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Defense-in-depth boundary for the mobile-only ONSITE identity.
 *
 * ONSITE is intentionally not a general PackFlow role. An ONSITE bearer token
 * may authenticate and may only resolve a packet for opening verification or
 * submit the opening proof itself. This protects older controllers that may
 * still use broad authenticated guards from accidentally becoming reachable by
 * an onsite account.
 *
 * Existing roles are completely unaffected by this interceptor.
 */
@Component
public class OnsiteApiIsolationInterceptor implements HandlerInterceptor {

    private static final String SITE_RESOLVE = "/api/site-lifecycle/resolve";
    private static final String SITE_OPEN = "/api/site-lifecycle/open";

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) throws IOException {

        if (request == null || response == null) {
            return true;
        }

        String method = safeUpper(request.getMethod());

        if (HttpMethod.OPTIONS.matches(method)) {
            return true;
        }

        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())
                || !hasAuthority(authentication, "ONSITE")) {
            return true;
        }

        String path = normalizePath(request);

        if (path.startsWith("/api/auth/")) {
            noStore(response);
            return true;
        }

        if (HttpMethod.POST.matches(method)
                && (SITE_RESOLVE.equals(path) || SITE_OPEN.equals(path))) {
            noStore(response);
            return true;
        }

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType("application/json;charset=UTF-8");
        noStore(response);
        response.getWriter().write(
                "{\"message\":\"ONSITE is a mobile-only packet-opening identity and cannot access other PackFlow APIs.\"}");
        return false;
    }

    private boolean hasAuthority(Authentication authentication, String requested) {
        String cleanRequested = normalizeAuthority(requested);

        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (authority == null) continue;
            if (cleanRequested.equals(normalizeAuthority(authority.getAuthority()))) {
                return true;
            }
        }

        return false;
    }

    private String normalizeAuthority(String value) {
        return value == null
                ? ""
                : value.trim()
                        .replaceFirst("(?i)^ROLE_", "")
                        .toUpperCase(Locale.ROOT);
    }

    private String normalizePath(HttpServletRequest request) {
        String servletPath = request.getServletPath();
        if (servletPath != null && !servletPath.isBlank()) {
            return trimTrailingSlash(servletPath.trim());
        }

        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();

        if (uri == null || uri.isBlank()) return "/";

        if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }

        return trimTrailingSlash(uri);
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) return "/";
        String result = value;
        while (result.length() > 1 && result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private String safeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private void noStore(HttpServletResponse response) {
        response.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, max-age=0");
        response.setHeader("Pragma", "no-cache");
    }
}
