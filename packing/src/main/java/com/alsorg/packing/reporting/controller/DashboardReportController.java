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
import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;
import com.alsorg.packing.reporting.dto.DashboardTraceRow;
import com.alsorg.packing.reporting.service.DashboardTraceService;

@RestController
@RequestMapping("/api/reports/dashboard")
public class DashboardReportController {

    private final DashboardReportService service;
    private final CurrentUserService currentUserService;
    private final DashboardTraceService traceService;

    public DashboardReportController(
            DashboardReportService service,
            CurrentUserService currentUserService,
            DashboardTraceService traceService) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.traceService = traceService;
    }

    @GetMapping
    public DashboardStatsDTO getDashboardStats() {
        return service.getDashboardStats();
    }

    @GetMapping("/daily-throughput/users")
    public List<DailyThroughputUserDTO> getDailyThroughputUsers(
            @RequestParam String type,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN can view user-wise throughput");
        }

        try {
            return service.getTodayThroughputUsers(type);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage());
        }
    }

    @GetMapping("/inventory-trace")
    public List<DashboardTraceRow> getInventoryTrace(
            @RequestParam(defaultValue = "all") String type,

            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,

            @RequestParam(required = false) String search,

            @RequestParam(defaultValue = "250") int limit,

            @RequestParam(defaultValue = "0") int offset) {
        return traceService.getInventoryTrace(
                type,
                from,
                to,
                search,
                limit,
                offset);
    }
}