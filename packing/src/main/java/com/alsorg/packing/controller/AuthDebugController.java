package com.alsorg.packing.controller;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AuthDebugController {

    private final boolean enabled;

    public AuthDebugController(
            @Value("${app.security.auth-debug-enabled:false}") boolean enabled) {
        this.enabled = enabled;
    }

    @GetMapping("/api/auth/debug")
    @PreAuthorize("hasAuthority('ADMIN')")
    public Map<String, Object> debug() {
        if (!enabled) {
            /* Hide the diagnostic surface completely in production by default. */
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Not found");
        }

        Authentication auth = SecurityContextHolder
                .getContext()
                .getAuthentication();

        Map<String, Object> data = new LinkedHashMap<>();

        if (auth == null) {
            data.put("authenticated", false);
            data.put("name", null);
            data.put("authorities", null);
            return data;
        }

        data.put("authenticated", auth.isAuthenticated());
        data.put("name", auth.getName());
        data.put(
                "authorities",
                auth.getAuthorities()
                        .stream()
                        .map(Object::toString)
                        .collect(Collectors.toList()));

        return data;
    }
}
