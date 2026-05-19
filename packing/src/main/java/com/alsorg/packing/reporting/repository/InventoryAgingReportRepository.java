package com.alsorg.packing.reporting.repository;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.reporting.dto.InventoryAgingRow;
import com.alsorg.packing.service.ZohoItemCacheService;

@Repository
public class InventoryAgingReportRepository {

    private final ZohoItemCacheService cacheService;

    public InventoryAgingReportRepository(
            ZohoItemCacheService cacheService
    ) {
        this.cacheService = cacheService;
    }

    /**
     * Inventory Aging = Days since items were loaded into cache
     * (i.e. waiting to be packed)
     */
    public List<InventoryAgingRow> fetchInventoryAging() {

        LocalDate today = LocalDate.now();
        LocalDate cacheLoadedDate = cacheService.getCacheLoadedDate();

        return cacheService
                .getPage(1, Integer.MAX_VALUE)
                .stream()
                .map(item ->
                        new InventoryAgingRow(
                                item.getZohoItemId(),
                                item.getName(),
                                item.getClientName(),
                                calculateDays(cacheLoadedDate, today)
                        )
                )
                .toList();
    }

    private long calculateDays(
            LocalDate start,
            LocalDate end
    ) {
        if (start == null) {
            return 0;
        }
        return ChronoUnit.DAYS.between(start, end);
    }
}
