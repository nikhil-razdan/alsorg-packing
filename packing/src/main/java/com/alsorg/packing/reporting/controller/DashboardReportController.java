package com.alsorg.packing.reporting.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.reporting.dto.DailyThroughputUserDTO;
import com.alsorg.packing.reporting.dto.DashboardStatsDTO;
import com.alsorg.packing.reporting.service.DashboardReportService;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/reports/dashboard")
public class DashboardReportController {

    private final DashboardReportService service;
    private final CurrentUserService currentUserService;

    public DashboardReportController(
            DashboardReportService service,
            CurrentUserService currentUserService
    ) {
        this.service = service;
        this.currentUserService = currentUserService;
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
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
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
}