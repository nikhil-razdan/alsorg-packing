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

        boolean nativeMobileClient =
                isNativeMobileClient(request);

        boolean authLogin =
                isAuthLogin(request);

        boolean hasBearerToken =
                hasBearerToken(request);

        /*
         * Native ShipTrack transport is explicitly bearer-based.
         *
         * IMPORTANT:
         * This check intentionally happens before the generic Origin rejection.
         * Some React Native / Expo networking stacks may supply an Origin header
         * even though the request is not running inside a browser. Requiring that
         * native Origin to match the FlowSuite web origin caused the production
         * "Request origin is not allowed" login failure.
         *
         * A normal modern browser is NOT treated as native mobile merely because
         * it sends X-Client-Type: mobile: browser Fetch Metadata headers make
         * isNativeMobileClient(...) return false, and normal CORS/origin policy
         * remains in force.
         */
        if (nativeMobileClient
                && (authLogin || hasBearerToken)) {

            filterChain.doFilter(
                    request,
                    response);

            return;
        }

        /*
         * Any browser/non-native request that supplies an Origin must supply an
         * exact configured origin. This protects public unsafe endpoints too.
         */
        if (originHeader != null
                && !isAllowedOrigin(originHeader)) {

            writeForbidden(response);
            return;
        }

        boolean hasAccessCookie =
                hasAccessCookie(request);

        boolean bearerOnly =
                hasBearerToken
                        && !hasAccessCookie;

        /*
         * Generic API clients using Bearer-only auth remain stateless and do not
         * participate in browser ambient-cookie CSRF semantics.
         */
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
         * Browser login occurs before a new auth cookie exists. Modern browsers
         * send Origin for cross-origin POSTs. If a browser explicitly identifies
         * the request as cross-site but supplies neither a trusted Origin nor a
         * trusted Referer, refuse it.
         */
        if (!hasAccessCookie
                && authLogin
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

        if (authorization == null
                || authorization.length() <= 7) {
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

    /**
     * X-Client-Type is a transport hint, not an authorization boundary.
     *
     * Normal modern browsers attach Fetch Metadata headers. Native Expo / React
     * Native networking does not. This allows native ShipTrack to remain
     * independent of browser Origin headers without turning a normal browser
     * request into a bearer-token-returning mobile login just by adding a header.
     */
    private boolean isNativeMobileClient(
            HttpServletRequest request) {

        String clientType = trimToNull(
                request.getHeader("X-Client-Type"));

        if (clientType == null
                || !"mobile".equalsIgnoreCase(
                        clientType)) {
            return false;
        }

        return !hasBrowserFetchMetadata(
                request);
    }

    private boolean hasBrowserFetchMetadata(
            HttpServletRequest request) {

        return trimToNull(
                request.getHeader("Sec-Fetch-Site")) != null
                || trimToNull(
                        request.getHeader("Sec-Fetch-Mode")) != null
                || trimToNull(
                        request.getHeader("Sec-Fetch-Dest")) != null
                || trimToNull(
                        request.getHeader("Sec-Fetch-User")) != null;
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
                .map(this::normalizeConfiguredOrigin)
                .collect(
                        Collectors.toCollection(
                                LinkedHashSet::new));
    }

    private String normalizeConfiguredOrigin(
            String value) {

        String clean = trimToNull(value);

        if (clean == null) {
            throw new IllegalStateException(
                    "Blank app.security.allowed-origins entry");
        }

        try {
            URI uri = URI.create(clean);

            if (uri.getUserInfo() != null
                    || uri.getQuery() != null
                    || uri.getFragment() != null) {
                throw new IllegalStateException(
                        "Invalid app.security.allowed-origins entry: "
                                + value);
            }

            String path = uri.getPath();

            if (path != null
                    && !path.isBlank()
                    && !"/".equals(path)) {
                throw new IllegalStateException(
                        "Allowed origins must not contain a path: "
                                + value);
            }

            String normalized = normalizeOrigin(
                    clean);

            if (normalized == null) {
                throw new IllegalStateException(
                        "Invalid app.security.allowed-origins entry: "
                                + value);
            }

            return normalized;

        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "Invalid app.security.allowed-origins entry: "
                            + value,
                    exception);
        }
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
