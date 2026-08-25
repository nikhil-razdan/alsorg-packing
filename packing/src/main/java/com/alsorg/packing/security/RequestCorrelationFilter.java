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

    private static final Pattern SAFE_ID = Pattern.compile(
            "^[A-Za-z0-9._-]{8,128}$");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        String requestId = resolveRequestId(
                request.getHeader(HEADER));

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

    private String resolveRequestId(
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
}
