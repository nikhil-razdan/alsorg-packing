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
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.UtlWorkflowService;

/**
 * Defense-in-depth response isolation for UTL-routed DispatchedItem records.
 *
 * Database-level filtering remains the primary boundary for the paged Dispatch
 * register.  This advice protects legacy/list endpoints too and deliberately
 * preserves two operational exceptions required by PackFlow:
 *
 * 1. A normal Warehouse user may see same-plant UTL rows when reading the
 *    ordinary /api/warehouse queue, so UTL Packing can hand work to the normal
 *    AL-P3/WR-38 Warehouse team without exposing it on unrelated endpoints.
 * 2. Normal WR-38 operational users may see the combined normal + UTL WR-38
 *    plant view, as required by the separate WR-38 workflow.
 */
@ControllerAdvice
public class UtlDispatchIsolationResponseAdvice
        implements ResponseBodyAdvice<Object> {

    private final UtlWorkflowService utlWorkflowService;
    private final CurrentUserService currentUserService;

    public UtlDispatchIsolationResponseAdvice(
            UtlWorkflowService utlWorkflowService,
            CurrentUserService currentUserService) {
        this.utlWorkflowService = utlWorkflowService;
        this.currentUserService = currentUserService;
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

        String requestPath = request == null || request.getURI() == null
                ? ""
                : String.valueOf(request.getURI().getPath());

        if (body instanceof DispatchedItem item) {
            return canCurrentUserRead(item, requestPath)
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
                    || canCurrentUserRead(item, requestPath)) {
                filtered.add(value);
            }
        }

        return filtered;
    }

    private boolean canCurrentUserRead(
            DispatchedItem item,
            String requestPath) {

        if (item == null || item.getPacketItemId() == null) {
            return true;
        }

        boolean routed = utlWorkflowService
                .findRoutingByPacketItemId(item.getPacketItemId())
                .isPresent();

        if (!routed) {
            return true;
        }

        User user;

        try {
            user = currentUserService.requireCurrentUser();
        } catch (RuntimeException exception) {
            return false;
        }

        if (currentUserService.isAdmin(user)) {
            return true;
        }

        String itemPlant = normalize(item.getPlantCode());

        /*
         * Ordinary Warehouse exception is endpoint-scoped.  It lets the normal
         * same-plant Warehouse team receive UTL work without widening normal
         * Dispatch visibility or exposing the other UTL plant/team.
         */
        if (requestPath.startsWith("/api/warehouse")
                && !currentUserService.isUtlUser(user)
                && currentUserService.isWarehouse(user)
                && itemPlant != null
                && currentUserService.canAccessPlant(user, itemPlant)) {
            return true;
        }

        /*
         * WR-38 is explicitly different: normal operational WR-38 identities
         * see the plant's normal and UTL records together.
         */
        if ("WR-38".equals(itemPlant)
                && !currentUserService.isUtlUser(user)
                && currentUserService.canAccessPlant(user, "WR-38")
                && currentUserService.hasAnyRole(
                        user,
                        "PACKING",
                        "WAREHOUSE",
                        "DISPATCH",
                        "LOGISTICS")) {
            return true;
        }

        return utlWorkflowService.canCurrentUserRead(item);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim().toUpperCase(java.util.Locale.ROOT);
        return clean.isBlank() ? null : clean;
    }
}
