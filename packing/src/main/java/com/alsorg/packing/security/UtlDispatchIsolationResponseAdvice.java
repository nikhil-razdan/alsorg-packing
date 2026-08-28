package com.alsorg.packing.security;

import java.util.ArrayList;
import java.util.List;

import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.service.UtlWorkflowService;

/**
 * Defense-in-depth read isolation for UTL-routed dispatch records.
 *
 * Existing server paging remains untouched.  If a normal plant dispatch page
 * happens to contain a UTL row assigned to another dispatcher, that row is
 * removed before JSON serialization.  Mutation endpoints are independently
 * protected by UtlWorkflowService, so this advice is not the authorization
 * boundary by itself.
 */
@ControllerAdvice
public class UtlDispatchIsolationResponseAdvice
        implements ResponseBodyAdvice<Object> {

    private final UtlWorkflowService utlWorkflowService;

    public UtlDispatchIsolationResponseAdvice(
            UtlWorkflowService utlWorkflowService) {
        this.utlWorkflowService = utlWorkflowService;
    }

    @Override
    public boolean supports(
            MethodParameter returnType,
            Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response) {

        if (body instanceof DispatchedItem item) {
            return utlWorkflowService.canCurrentUserRead(item)
                    ? item
                    : null;
        }

        if (!(body instanceof List<?> source) || source.isEmpty()) {
            return body;
        }

        boolean dispatchedItems = source.stream()
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .map(DispatchedItem.class::isInstance)
                .orElse(false);

        if (!dispatchedItems) {
            return body;
        }

        List<Object> filtered = new ArrayList<>(source.size());
        for (Object value : source) {
            if (!(value instanceof DispatchedItem item)
                    || utlWorkflowService.canCurrentUserRead(item)) {
                filtered.add(value);
            }
        }
        return filtered;
    }
}
