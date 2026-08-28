package com.alsorg.packing.security;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Gives every HTTP request a stable correlation id so frontend errors,
 * security denials and backend logs can be tied to the same request.
 */
@Component
public class RequestCorrelationFilter
        extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-ID";
    public static final String MDC_KEY = "requestId";

    public static final String REQUEST_ATTRIBUTE =
            RequestCorrelationFilter.class.getName() + ".REQUEST_ID";

    private static final Pattern SAFE_ID = Pattern.compile(
            "^[A-Za-z0-9._-]{8,128}$");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        String requestId =
                requestIdFromAttribute(
                        request);

        if (requestId == null) {
            requestId = resolveOrCreate(
                    request.getHeader(HEADER));

            request.setAttribute(
                    REQUEST_ATTRIBUTE,
                    requestId);
        }

        response.setHeader(
                HEADER,
                requestId);

        MDC.put(
                MDC_KEY,
                requestId);

        try {
            filterChain.doFilter(
                    request,
                    response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    public static String resolveOrCreate(
            String incoming) {

        if (incoming != null) {
            String clean = incoming.trim();

            if (SAFE_ID.matcher(clean).matches()) {
                return clean;
            }
        }

        return UUID.randomUUID()
                .toString();
    }

    private String requestIdFromAttribute(
            HttpServletRequest request) {

        Object value = request.getAttribute(
                REQUEST_ATTRIBUTE);

        if (!(value instanceof String text)) {
            return null;
        }

        String clean = text.trim();

        return SAFE_ID.matcher(clean).matches()
                ? clean
                : null;
    }
}
