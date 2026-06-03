package com.alsorg.packing.reporting.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.reporting.dto.DailyThroughputUserDTO;
import com.alsorg.packing.reporting.dto.DashboardStatsDTO;
import com.alsorg.packing.reporting.service.DashboardReportService;
import com.alsorg.packing.security.JwtUtil;

@RestController
@RequestMapping("/api/reports/dashboard")
public class DashboardReportController {

    private final DashboardReportService service;

    public DashboardReportController(DashboardReportService service) {
        this.service = service;
    }

    @GetMapping
    public DashboardStatsDTO getDashboardStats() {
        return service.getDashboardStats();
    }

    @GetMapping("/daily-throughput/users")
    public List<DailyThroughputUserDTO> getDailyThroughputUsers(
            @RequestParam String type,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        String token = extractToken(auth);

        String role = JwtUtil.getRole(token);

        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN can view user-wise throughput"
            );
        }

        try {
            return service.getTodayThroughputUsers(type);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage()
            );
        }
    }

    private String extractToken(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Missing or invalid Authorization header"
            );
        }

        return auth.replace("Bearer ", "").trim();
    }
}