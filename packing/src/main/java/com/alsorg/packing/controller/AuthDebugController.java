package com.alsorg.packing.controller;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthDebugController {

    @GetMapping("/api/auth/debug")
    public Map<String, Object> debug() {
        Authentication auth =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        Map<String, Object> data =
                new LinkedHashMap<>();

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
                        .collect(Collectors.toList())
        );

        return data;
    }
}