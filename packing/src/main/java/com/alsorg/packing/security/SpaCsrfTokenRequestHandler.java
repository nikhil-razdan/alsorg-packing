package com.alsorg.packing.security;

import java.util.function.Supplier;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.util.StringUtils;

/**
 * SPA-compatible CSRF handler based on Spring Security's documented pattern.
 *
 * The expected token remains protected by the XOR/BREACH handler when exposed
 * as a request attribute, while JavaScript sends the raw value in the CSRF
 * header returned by GET /api/auth/csrf.
 */
public final class SpaCsrfTokenRequestHandler
        implements CsrfTokenRequestHandler {

    /**
     * Raw repository token exposed only as an internal request attribute.
     * The controller returns this value to the trusted SPA; it is never used
     * as an authentication credential and never persisted by the frontend.
     */
    public static final String RAW_CSRF_ATTRIBUTE =
            SpaCsrfTokenRequestHandler.class.getName() + ".RAW_CSRF_TOKEN";

    private final CsrfTokenRequestHandler plain =
            new CsrfTokenRequestAttributeHandler();

    private final CsrfTokenRequestHandler xor =
            new XorCsrfTokenRequestAttributeHandler();

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            Supplier<CsrfToken> csrfToken) {

        /*
         * Resolve the repository/raw token first. Accessing the deferred token
         * also causes CookieCsrfTokenRepository to create/save XSRF-TOKEN when
         * one is not already present.
         *
         * XorCsrfTokenRequestAttributeHandler deliberately exposes a masked
         * token as the ordinary request attribute for BREACH protection. Our
         * SPA, however, sends the token in a request header, and the plain
         * header resolver must compare that header with the RAW repository
         * token. Keep the raw value in a private request attribute so
         * /api/auth/csrf can return the correct header token.
         */
        CsrfToken rawToken = csrfToken.get();

        request.setAttribute(
                RAW_CSRF_ATTRIBUTE,
                rawToken);

        xor.handle(
                request,
                response,
                () -> rawToken);
    }

    @Override
    public String resolveCsrfTokenValue(
            HttpServletRequest request,
            CsrfToken csrfToken) {

        String headerValue =
                request.getHeader(
                        csrfToken.getHeaderName());

        if (StringUtils.hasText(
                headerValue)) {

            return plain.resolveCsrfTokenValue(
                    request,
                    csrfToken);
        }

        return xor.resolveCsrfTokenValue(
                request,
                csrfToken);
    }
}
