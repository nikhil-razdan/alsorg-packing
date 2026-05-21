package com.alsorg.packing.reporting.repository;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.reporting.dto.InventoryAgingRow;
import com.alsorg.packing.repository.DispatchedItemRepository;

@Repository
public class InventoryAgingReportRepository {

    private final DispatchedItemRepository repo;

    public InventoryAgingReportRepository(
            DispatchedItemRepository repo
    ) {
        this.repo = repo;
    }

    public List<InventoryAgingRow> fetchInventoryAging() {

        List<DispatchedItem> items = repo.findByStatusIn(
                List.of(
                        ItemDispatchStatus.IN_WAREHOUSE,
                        ItemDispatchStatus.READY_TO_STORE,
                        ItemDispatchStatus.WAREHOUSE_REQUESTED,
                        ItemDispatchStatus.READY_TO_DISPATCH
                )
        );

        LocalDateTime now = LocalDateTime.now();

        return items.stream()
                .map(item -> {

                    LocalDateTime start =
                            item.getStoredAt() != null
                                    ? item.getStoredAt()
                                    : item.getPackedAt();

                    long days = 0;

                    if (start != null) {
                        days = ChronoUnit.DAYS.between(start, now);
                    }

                    return new InventoryAgingRow(
                            item.getZohoItemId(),
                            item.getName(),
                            item.getClientName(),
                            days
                    );
                })
                .toList();
    }
}