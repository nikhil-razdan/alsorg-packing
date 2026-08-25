package com.alsorg.packing.security;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * CSRF defense for the browser HttpOnly-cookie authentication path.
 *
 * FlowSuite also supports ShipTrack/mobile Bearer tokens. Bearer-only requests
 * do not rely on ambient browser cookies and therefore do not require this
 * browser-origin check.
 *
 * For unsafe cookie-authenticated requests, the browser Origin (or Referer
 * fallback) must exactly match one of the configured frontend origins.
 */
@Component
public class TrustedOriginFilter
        extends OncePerRequestFilter {

    private final Set<String> allowedOrigins;

    public TrustedOriginFilter(
            @Value("${app.security.allowed-origins:http://localhost:5173,http://localhost:3000,https://alsorg-packing-frontend.onrender.com}")
            String configuredOrigins) {

        this.allowedOrigins = parseAllowedOrigins(
                configuredOrigins);

        if (this.allowedOrigins.isEmpty()) {
            throw new IllegalStateException(
                    "At least one app.security.allowed-origins value is required");
        }
    }

    @Override
    protected boolean shouldNotFilter(
            HttpServletRequest request) {

        String method = request.getMethod();

        return HttpMethod.GET.matches(method)
                || HttpMethod.HEAD.matches(method)
                || HttpMethod.OPTIONS.matches(method)
                || HttpMethod.TRACE.matches(method);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        String originHeader = trimToNull(
                request.getHeader("Origin"));

        String refererHeader = trimToNull(
                request.getHeader("Referer"));

        String secFetchSite = trimToNull(
                request.getHeader("Sec-Fetch-Site"));

        /*
         * Any browser that supplies an Origin must supply a trusted one.
         * This protects public POST endpoints too, not only authenticated ones.
         */
        if (originHeader != null
                && !isAllowedOrigin(originHeader)) {

            writeForbidden(response);
            return;
        }

        boolean hasAccessCookie = hasAccessCookie(request);
        boolean bearerOnly = hasBearerToken(request)
                && !hasAccessCookie;

        if (bearerOnly) {
            filterChain.doFilter(
                    request,
                    response);

            return;
        }

        /*
         * Cookie-authenticated unsafe methods must prove they came from our
         * exact frontend origin. If Origin is unavailable, Referer is the
         * standards-compatible fallback.
         */
        if (hasAccessCookie) {
            boolean trusted = originHeader != null
                    ? isAllowedOrigin(originHeader)
                    : isAllowedReferer(refererHeader);

            if (!trusted) {
                writeForbidden(response);
                return;
            }
        }

        /*
         * Login occurs before an auth cookie exists. Modern browsers send
         * Origin for cross-origin POSTs. If a browser identifies the request
         * as cross-site but supplies neither a trusted Origin nor Referer,
         * refuse it. Native/mobile clients normally do not send Sec-Fetch-Site.
         */
        if (!hasAccessCookie
                && isAuthLogin(request)
                && !isMobileClient(request)
                && "cross-site".equalsIgnoreCase(secFetchSite)
                && originHeader == null
                && !isAllowedReferer(refererHeader)) {

            writeForbidden(response);
            return;
        }

        filterChain.doFilter(
                request,
                response);
    }

    private boolean hasAccessCookie(
            HttpServletRequest request) {

        Cookie[] cookies = request.getCookies();

        if (cookies == null) {
            return false;
        }

        for (Cookie cookie : cookies) {
            if (cookie == null) {
                continue;
            }

            if (JwtAuthenticationFilter.ACCESS_COOKIE.equals(
                    cookie.getName())
                    && trimToNull(cookie.getValue()) != null) {
                return true;
            }
        }

        return false;
    }

    private boolean hasBearerToken(
            HttpServletRequest request) {

        String authorization = trimToNull(
                request.getHeader("Authorization"));

        if (authorization == null) {
            return false;
        }

        return authorization.regionMatches(
                true,
                0,
                "Bearer ",
                0,
                7)
                && trimToNull(
                        authorization.substring(7)) != null;
    }

    private boolean isAuthLogin(
            HttpServletRequest request) {

        return "/api/auth/login".equals(
                request.getServletPath());
    }

    private boolean isMobileClient(
            HttpServletRequest request) {

        String clientType = trimToNull(
                request.getHeader("X-Client-Type"));

        return clientType != null
                && "mobile".equalsIgnoreCase(
                        clientType);
    }

    private boolean isAllowedOrigin(
            String value) {

        String normalized = normalizeOrigin(value);

        return normalized != null
                && allowedOrigins.contains(
                        normalized);
    }

    private boolean isAllowedReferer(
            String value) {

        String normalized = normalizeOrigin(value);

        return normalized != null
                && allowedOrigins.contains(
                        normalized);
    }

    private Set<String> parseAllowedOrigins(
            String configuredOrigins) {

        if (configuredOrigins == null) {
            return Set.of();
        }

        return Arrays.stream(
                        configuredOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(this::normalizeOrigin)
                .filter(value -> value != null
                        && !value.isBlank())
                .collect(
                        Collectors.toCollection(
                                LinkedHashSet::new));
    }

    private String normalizeOrigin(
            String value) {

        String clean = trimToNull(value);

        if (clean == null
                || "null".equalsIgnoreCase(clean)) {
            return null;
        }

        try {
            URI uri = URI.create(clean);

            String scheme = trimToNull(
                    uri.getScheme());

            String host = trimToNull(
                    uri.getHost());

            if (scheme == null
                    || host == null) {
                return null;
            }

            scheme = scheme.toLowerCase(
                    Locale.ROOT);

            host = host.toLowerCase(
                    Locale.ROOT);

            if (!"http".equals(scheme)
                    && !"https".equals(scheme)) {
                return null;
            }

            int port = uri.getPort();

            boolean defaultPort = port < 0
                    || ("http".equals(scheme)
                            && port == 80)
                    || ("https".equals(scheme)
                            && port == 443);

            return scheme
                    + "://"
                    + host
                    + (defaultPort
                            ? ""
                            : ":" + port);

        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private String trimToNull(
            String value) {

        if (value == null) {
            return null;
        }

        String clean = value.trim();

        return clean.isBlank()
                ? null
                : clean;
    }

    private void writeForbidden(
            HttpServletResponse response)
            throws IOException {

        if (response.isCommitted()) {
            return;
        }

        response.setStatus(
                HttpServletResponse.SC_FORBIDDEN);

        response.setContentType(
                MediaType.APPLICATION_JSON_VALUE);

        response.setCharacterEncoding(
                "UTF-8");

        response.getWriter()
                .write(
                        "{\"message\":\"Request origin is not allowed\"}");
    }
}
