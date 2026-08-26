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

    private final CsrfTokenRequestHandler plain =
            new CsrfTokenRequestAttributeHandler();

    private final CsrfTokenRequestHandler xor =
            new XorCsrfTokenRequestAttributeHandler();

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            Supplier<CsrfToken> csrfToken) {

        xor.handle(
                request,
                response,
                csrfToken);

        /*
         * Force deferred token loading so CookieCsrfTokenRepository returns a
         * fresh cookie whenever one is needed.
         */
        csrfToken.get();
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
