package com.alsorg.packing.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpMethod;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * Applies Spring Security CSRF validation only to unsafe browser requests
 * that carry the FlowSuite HttpOnly access cookie.
 *
 * ShipTrack/mobile uses Authorization Bearer tokens and therefore does not
 * participate in browser ambient-cookie CSRF semantics.
 */
public final class CookieCsrfProtectionMatcher
        implements RequestMatcher {

    private final boolean enabled;

    public CookieCsrfProtectionMatcher(
            boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public boolean matches(
            HttpServletRequest request) {

        if (!enabled
                || request == null) {
            return false;
        }

        String method = request.getMethod();

        if (HttpMethod.GET.matches(method)
                || HttpMethod.HEAD.matches(method)
                || HttpMethod.OPTIONS.matches(method)
                || HttpMethod.TRACE.matches(method)) {
            return false;
        }

        /*
         * Login must remain possible before an authenticated browser session
         * exists, including when an old/stale cookie is still present.
         * TrustedOriginFilter still validates the browser origin.
         */
        String path = request.getServletPath();

        if ("/api/auth/login".equals(path)
                || isCredentialFreePublicPath(path)) {
            return false;
        }

        return hasAccessCookie(
                request);
    }

    private boolean isCredentialFreePublicPath(
            String path) {

        return path != null
                && (path.startsWith(
                                "/api/assetflow/public/")
                        || path.startsWith(
                                "/api/hrflow/public/"));
    }

    private boolean hasAccessCookie(
            HttpServletRequest request) {

        Cookie[] cookies =
                request.getCookies();

        if (cookies == null) {
            return false;
        }

        for (Cookie cookie : cookies) {
            if (cookie == null
                    || !JwtAuthenticationFilter.ACCESS_COOKIE.equals(
                            cookie.getName())) {
                continue;
            }

            String value = cookie.getValue();

            return value != null
                    && !value.isBlank()
                    && !"null".equalsIgnoreCase(value)
                    && !"undefined".equalsIgnoreCase(value);
        }

        return false;
    }
}
