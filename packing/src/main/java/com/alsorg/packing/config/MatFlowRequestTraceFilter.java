package com.alsorg.packing.config;

import static com.alsorg.packing.controller.matflow.MatFlowApiContract.REQUEST_ID_HEADER;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import org.slf4j.MDC;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import org.springframework.stereotype.Component;

import org.springframework.web.filter.OncePerRequestFilter;

import com.alsorg.packing.security.RequestCorrelationFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MatFlowRequestTraceFilter
        extends OncePerRequestFilter {

    private static final String MDC_KEY = "matflowRequestId";

    @Override
    protected boolean shouldNotFilter(
            HttpServletRequest request) {
        String path = request.getServletPath();

        return path == null ||
                !path.startsWith(
                        "/api/matflow");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        Object existing =
                request.getAttribute(
                        RequestCorrelationFilter.REQUEST_ATTRIBUTE);

        String requestId =
                existing instanceof String text
                        ? RequestCorrelationFilter.resolveOrCreate(
                                text)
                        : null;

        if (requestId == null) {
            requestId = RequestCorrelationFilter
                    .resolveOrCreate(
                            request.getHeader(
                                    REQUEST_ID_HEADER));

            request.setAttribute(
                    RequestCorrelationFilter.REQUEST_ATTRIBUTE,
                    requestId);
        }

        response.setHeader(
                RequestCorrelationFilter.HEADER,
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