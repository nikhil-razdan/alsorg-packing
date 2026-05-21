package com.alsorg.packing.reporting.service;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DashboardStatsDTO;
import com.alsorg.packing.reporting.repository.DashboardReportRepository;

@Service
public class DashboardReportService {

    private final DashboardReportRepository repo;

    public DashboardReportService(DashboardReportRepository repo) {
        this.repo = repo;
    }

    public DashboardStatsDTO getDashboardStats() {

        long totalItems = repo.countTotalItems();

        long packedItems = repo.countPackedItems();

        long dispatchedItems = repo.countDispatchedItems();

        long pendingItems = repo.countPendingItems();

        long stickersGenerated = repo.countStickersGenerated();

        return new DashboardStatsDTO(
                totalItems,
                packedItems,
                dispatchedItems,
                pendingItems,
                stickersGenerated
        );
    }

}
