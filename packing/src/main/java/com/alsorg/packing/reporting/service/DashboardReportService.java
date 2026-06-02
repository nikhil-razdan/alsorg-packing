package com.alsorg.packing.reporting.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

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

        ZoneId zone = ZoneId.of("Asia/Kolkata");

        LocalDate today = LocalDate.now(zone);

        LocalDateTime startOfToday = today.atStartOfDay();

        LocalDateTime startOfTomorrow = today
                .plusDays(1)
                .atStartOfDay();

        long warehouseItems = repo.countWarehouseItems();

        long readyToDispatchItems = repo.countReadyToDispatchItems();

        long readyItems = repo.countReadyItems();

        long totalItems =
                warehouseItems
                        + readyToDispatchItems
                        + readyItems;

        long packedItems = repo.countPackedItems();

        long dispatchedItems = repo.countDispatchedItems();

        long pendingItems = repo.countPendingItems();

        long stickersGenerated = repo.countStickersGenerated();

        long todayStickerGenerated =
                repo.countTodayStickerGenerated(
                        startOfToday,
                        startOfTomorrow
                );

        long todayChallanGenerated =
                repo.countTodayChallanGenerated(
                        startOfToday,
                        startOfTomorrow
                );

        return new DashboardStatsDTO(
                totalItems,
                warehouseItems,
                readyToDispatchItems,
                readyItems,
                packedItems,
                dispatchedItems,
                pendingItems,
                stickersGenerated,
                todayStickerGenerated,
                todayChallanGenerated
        );
    }
}