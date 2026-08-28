package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.reporting.dto.DailyThroughputUserDTO;
import com.alsorg.packing.reporting.dto.DashboardStatsDTO;
import com.alsorg.packing.reporting.dto.DashboardTraceRow;
import com.alsorg.packing.reporting.dto.MasterItemDetailResponse;
import com.alsorg.packing.reporting.dto.MasterItemPageResponse;
import com.alsorg.packing.reporting.service.DashboardReportService;
import com.alsorg.packing.reporting.service.DashboardTraceService;
import com.alsorg.packing.reporting.service.MasterItemDashboardService;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/reports/dashboard")
@PreAuthorize("isAuthenticated()")
public class DashboardReportController {

    private static final int MAX_MASTER_PAGE_SIZE = 100;
    private static final int MAX_TRACE_PAGE_SIZE = 500;

    private final DashboardReportService service;
    private final CurrentUserService currentUserService;
    private final DashboardTraceService traceService;
    private final MasterItemDashboardService masterItemDashboardService;

    public DashboardReportController(
            DashboardReportService service,
            CurrentUserService currentUserService,
            DashboardTraceService traceService,
            MasterItemDashboardService masterItemDashboardService) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.traceService = traceService;
        this.masterItemDashboardService = masterItemDashboardService;
    }

    @GetMapping
    public DashboardStatsDTO getDashboardStats() {
        return service.getDashboardStats();
    }

    @GetMapping("/daily-throughput/users")
    @PreAuthorize("hasAuthority('ADMIN')")
    public List<DailyThroughputUserDTO> getDailyThroughputUsers(
            @RequestParam String type) {
        /*
         * Phase 3A identity rule: use the SecurityContext populated by the JWT
         * filter for both cookie and Bearer sessions. Do not make a controller
         * depend on a manually forwarded Authorization header.
         */
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isAdmin(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN can view user-wise throughput");
        }

        try {
            return service.getTodayThroughputUsers(type);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    exception.getMessage());
        }
    }

    @GetMapping("/inventory-trace")
    public List<DashboardTraceRow> getInventoryTrace(
            @RequestParam(defaultValue = "all") String type,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to,

            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "250") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return traceService.getInventoryTrace(
                type,
                from,
                to,
                search,
                Math.min(Math.max(limit, 1), MAX_TRACE_PAGE_SIZE),
                Math.max(offset, 0));
    }

    @GetMapping("/master-items")
    public MasterItemPageResponse getMasterItems(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String packingStatus,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String clientName,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to,

            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset) {
        String finalStatus = firstNonBlank(
                packingStatus,
                status,
                "ALL");

        String finalClient = firstNonBlank(
                clientName,
                client,
                null);

        int finalSize = limit != null && limit > 0
                ? limit
                : size != null && size > 0
                        ? size
                        : 20;

        finalSize = Math.min(
                Math.max(finalSize, 10),
                MAX_MASTER_PAGE_SIZE);

        int finalPage;

        if (page != null && page >= 0) {
            finalPage = page;
        } else if (offset != null && offset >= 0) {
            finalPage = offset / finalSize;
        } else {
            finalPage = 0;
        }

        return masterItemDashboardService.getMasterItems(
                search,
                finalStatus,
                plantCode,
                finalClient,
                from,
                to,
                finalPage,
                finalSize);
    }

    @GetMapping("/master-items/{masterItemId}")
    public MasterItemDetailResponse getMasterItemDetail(
            @PathVariable UUID masterItemId) {
        return masterItemDashboardService.getMasterItemDetail(masterItemId);
    }

    private String firstNonBlank(
            String first,
            String second,
            String fallback) {
        if (first != null && !first.trim().isBlank()) {
            return first.trim();
        }

        if (second != null && !second.trim().isBlank()) {
            return second.trim();
        }

        return fallback;
    }
}
