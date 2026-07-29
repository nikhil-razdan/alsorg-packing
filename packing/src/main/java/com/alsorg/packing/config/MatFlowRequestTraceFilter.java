package com.alsorg.packing.config;

import static com.alsorg.packing.controller.matflow.MatFlowApiContract.REQUEST_ID_HEADER;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.MDC;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import org.springframework.stereotype.Component;

import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MatFlowRequestTraceFilter
        extends OncePerRequestFilter {

    private static final String MDC_KEY = "matflowRequestId";

    @Override
    protected boolean shouldNotFilter(
            HttpServletRequest request) {
        String path = request.getRequestURI();

        return path == null ||
                !path.startsWith(
                        "/api/matflow");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String requestId = clean(
                request.getHeader(
                        REQUEST_ID_HEADER));

        if (requestId == null) {
            requestId = UUID.randomUUID()
                    .toString();
        }

        response.setHeader(
                REQUEST_ID_HEADER,
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

    private String clean(
            String value) {
        if (value == null) {
            return null;
        }

        String result = value.trim();

        return result.isBlank()
                ? null
                : result;
    }
}