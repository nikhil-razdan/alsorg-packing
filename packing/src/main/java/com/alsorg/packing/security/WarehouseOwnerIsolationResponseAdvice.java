package com.alsorg.packing.security;

import java.util.List;
import java.util.Locale;

import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;

/**
 * Narrow read-side privacy guard for the two Warehouse list endpoints.
 *
 * - ADMIN: company-wide data (existing admin behavior)
 * - WAREHOUSE / DISPATCH: complete assigned-plant operational hand-off queue
 * - personal PACKING users: only their own records inside assigned plant scope
 *
 * The advice never changes any Warehouse mutation endpoint, approval, gate-pass,
 * return, bulk edit or lifecycle operation.
 */
@RestControllerAdvice
public class WarehouseOwnerIsolationResponseAdvice implements ResponseBodyAdvice<Object> {

    private final CurrentUserService currentUserService;

    public WarehouseOwnerIsolationResponseAdvice(CurrentUserService currentUserService) {
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

        if (!(body instanceof List<?> values) || request == null) {
            return body;
        }

        String path = request.getURI() == null ? "" : request.getURI().getPath();
        if (!isWarehouseListPath(path)) {
            return body;
        }

        User user = currentUserService.requireCurrentUser();
        if (!shouldRestrictToOwner(user)) {
            return body;
        }

        String owner = normalize(user.getUsername());
        if (owner.isBlank()) {
            return List.of();
        }

        return values.stream()
                .filter(DispatchedItem.class::isInstance)
                .map(DispatchedItem.class::cast)
                .filter(item -> owner.equals(resolveOwner(item)))
                .toList();
    }

    private boolean shouldRestrictToOwner(User user) {
        if (user == null || currentUserService.isAdmin(user)) return false;

        return currentUserService.isPacking(user)
                && !currentUserService.hasAnyRole(
                        user,
                        "WAREHOUSE",
                        "DISPATCH",
                        "LOGISTICS");
    }

    private boolean isWarehouseListPath(String path) {
        if (path == null) return false;
        String clean = path.replaceAll("/+$", "");
        return clean.endsWith("/api/warehouse/items")
                || clean.endsWith("/api/warehouse/floor");
    }

    private String resolveOwner(DispatchedItem item) {
        if (item == null) return "";

        String createdBy = normalize(item.getCreatedBy());
        if (!createdBy.isBlank()) return createdBy;

        String packedBy = normalize(item.getPackedBy());
        if (!packedBy.isBlank()) return packedBy;

        return normalize(item.getDispatchedBy());
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toLowerCase(Locale.ROOT);
    }
}
