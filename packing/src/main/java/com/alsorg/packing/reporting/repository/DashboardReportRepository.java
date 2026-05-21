package com.alsorg.packing.reporting.repository;

import java.util.List;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;

@Repository
public class DashboardReportRepository {

    private final PacketItemRepository packetItemRepo;
    private final DispatchedItemRepository dispatchedRepo;

    public DashboardReportRepository(
            PacketItemRepository packetItemRepo,
            DispatchedItemRepository dispatchedRepo
    ) {
        this.packetItemRepo = packetItemRepo;
        this.dispatchedRepo = dispatchedRepo;
    }

    public long countTotalItems() {
        return packetItemRepo.count();
    }

    public long countPackedItems() {
        return dispatchedRepo.countByStatusIn(
                List.of(
                        ItemDispatchStatus.READY,
                        ItemDispatchStatus.READY_TO_STORE,
                        ItemDispatchStatus.WAREHOUSE_REQUESTED,
                        ItemDispatchStatus.IN_WAREHOUSE,
                        ItemDispatchStatus.READY_TO_DISPATCH
                )
        );
    }

    public long countDispatchedItems() {
        return dispatchedRepo.countByStatus(
                ItemDispatchStatus.DISPATCHED
        );
    }

    public long countPendingItems() {

        long total = packetItemRepo.count();

        long packed = countPackedItems();

        return Math.max(total - packed, 0);
    }

    public long countStickersGenerated() {
        return dispatchedRepo.count();
    }
}