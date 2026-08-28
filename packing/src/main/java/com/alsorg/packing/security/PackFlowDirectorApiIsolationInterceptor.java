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
 * Defense-in-depth boundary for PACKFLOW_DIRECTOR.
 *
 * The role is intentionally read-only inside PackFlow, even when the same user
 * also holds an independent profile in another FlowSuite module. Older PackFlow
 * controllers were created at different times and
 * some legacy endpoints may still use broad "authenticated" guards. This
 * interceptor prevents a director session from reaching those endpoints even if
 * a hidden URL is called manually.
 *
 * It does not change behavior for any other role.
 */
@Component
public class PackFlowDirectorApiIsolationInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) throws IOException {

        if (request == null || response == null) {
            return true;
        }

        String method = safeUpper(request.getMethod());

        /*
         * Never interfere with browser CORS/pre-flight negotiation.
         */
        if (HttpMethod.OPTIONS.matches(method)) {
            return true;
        }

        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())) {
            return true;
        }

        boolean admin = hasAuthority(authentication, "ADMIN");
        boolean director = hasAuthority(authentication, "PACKFLOW_DIRECTOR");

        if (!director || admin) {
            return true;
        }

        String path = normalizePath(request);

        if (path.startsWith("/api/auth/")) {
            noStore(response);
            return true;
        }

        if (HttpMethod.GET.matches(method)
                && ("/api/reports/dashboard".equals(path)
                        || "/api/analytics".equals(path))) {
            noStore(response);
            return true;
        }

        /*
         * A PackFlow Director may also hold an independent profile in another
         * FlowSuite module. Those module namespaces retain their own controller
         * and service authorization and are therefore safe to pass through.
         * PackFlow operational APIs remain blocked below.
         */
        if (path.startsWith("/api/bomflow/")
                || path.startsWith("/api/matflow/")
                || path.startsWith("/api/assetflow/")
                || path.startsWith("/api/hrflow/")) {
            return true;
        }

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType("application/json;charset=UTF-8");
        noStore(response);
        response.getWriter().write(
                "{\"message\":\"PACKFLOW_DIRECTOR is restricted to the read-only executive dashboard.\"}");

        return false;
    }

    private boolean hasAuthority(
            Authentication authentication,
            String requested) {

        if (authentication == null || requested == null) {
            return false;
        }

        String cleanRequested = normalizeAuthority(requested);

        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (authority == null) {
                continue;
            }

            String cleanAuthority = normalizeAuthority(authority.getAuthority());

            if (cleanRequested.equals(cleanAuthority)) {
                return true;
            }
        }

        return false;
    }

    private String normalizeAuthority(String value) {
        if (value == null) {
            return "";
        }

        return value
                .trim()
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

        if (uri == null || uri.isBlank()) {
            return "/";
        }

        if (contextPath != null
                && !contextPath.isBlank()
                && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }

        return trimTrailingSlash(uri);
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "/";
        }

        String result = value;

        while (result.length() > 1 && result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }

        return result;
    }

    private String safeUpper(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }

    private void noStore(HttpServletResponse response) {
        response.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, max-age=0");
        response.setHeader("Pragma", "no-cache");
    }
}
