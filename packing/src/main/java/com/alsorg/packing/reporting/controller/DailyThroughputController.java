package com.alsorg.packing.reporting.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.DailyUserThroughputResponse;
import com.alsorg.packing.reporting.service.DailyThroughputService;
import com.alsorg.packing.security.JwtUtil;

@RestController
@RequestMapping("/api/reports/dashboard/daily-throughput")
public class DailyThroughputController {

    private final DailyThroughputService service;

    public DailyThroughputController(
            DailyThroughputService service
    ) {
        this.service = service;
    }

    @GetMapping("/users")
    public ResponseEntity<List<DailyUserThroughputResponse>> userWiseWork(
            @RequestParam String type,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate date,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        String role = currentRoleFromTokenOrSecurity(auth);

        if (!"ADMIN".equalsIgnoreCase(role)) {
            return ResponseEntity.status(403).build();
        }

        return ResponseEntity.ok(
                service.getUserWiseWork(type, date)
        );
    }

    private String currentRoleFromTokenOrSecurity(String auth) {

        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                String token =
                        auth.replace("Bearer ", "").trim();

                String role =
                        JwtUtil.getRole(token);

                if (role != null && !role.isBlank()) {
                    return normalizeRole(role);
                }
            } catch (Exception e) {
                System.out.println(
                        "Could not extract role from JWT: "
                                + e.getMessage()
                );
            }
        }

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null
                && authentication.getAuthorities() != null) {

            return authentication.getAuthorities()
                    .stream()
                    .map(a -> normalizeRole(a.getAuthority()))
                    .filter(r -> "ADMIN".equalsIgnoreCase(r))
                    .findFirst()
                    .orElse("USER");
        }

        return "USER";
    }

    private String normalizeRole(String role) {
        if (role == null) {
            return "USER";
        }

        return role
                .replace("ROLE_", "")
                .trim()
                .toUpperCase();
    }
}