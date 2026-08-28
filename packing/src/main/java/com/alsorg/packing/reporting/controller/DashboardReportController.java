package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
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
public class DashboardReportController {

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

    /*
     * Aggregate dashboard numbers are intentionally available to only the two
     * dashboard identities. Director access stops here; raw record/user data
     * below remains ADMIN-only.
     */
    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN', 'PACKFLOW_DIRECTOR')")
    public DashboardStatsDTO getDashboardStats() {
        return service.getDashboardStats();
    }

    @GetMapping("/daily-throughput/users")
    @PreAuthorize("hasAuthority('ADMIN')")
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
    @PreAuthorize("hasAuthority('ADMIN')")
    public List<DashboardTraceRow> getInventoryTrace(
            @RequestParam(defaultValue = "all") String type,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
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

    @GetMapping("/master-items")
    @PreAuthorize("hasAuthority('ADMIN')")
    public MasterItemPageResponse getMasterItems(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String packingStatus,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String clientName,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
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
                700);

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
    @PreAuthorize("hasAuthority('ADMIN')")
    public MasterItemDetailResponse getMasterItemDetail(
            @PathVariable UUID masterItemId) {
        return masterItemDashboardService.getMasterItemDetail(
                masterItemId);
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
