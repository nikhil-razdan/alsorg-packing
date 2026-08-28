package com.alsorg.packing.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.domain.dashboard.DashboardResponse;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DashboardService;

@RestController
@RequestMapping("/api/analytics")
@PreAuthorize("hasAnyAuthority('ADMIN', 'PACKFLOW_DIRECTOR')")
public class DashboardController {

    private final DashboardService dashboardService;
    private final CurrentUserService currentUserService;

    public DashboardController(
            DashboardService dashboardService,
            CurrentUserService currentUserService) {
        this.dashboardService = dashboardService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public DashboardResponse getDashboard() {
        User user = currentUserService.requireCurrentUser();

        if (currentUserService.isAdmin(user)) {
            return dashboardService.getDashboard();
        }

        return dashboardService.getExecutiveDashboard();
    }
}
