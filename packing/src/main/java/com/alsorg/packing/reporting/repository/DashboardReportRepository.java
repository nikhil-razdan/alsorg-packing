package com.alsorg.packing.reporting.repository;

import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.ZohoStickerHistoryRepository;
import com.alsorg.packing.service.ZohoItemCacheService;

@Repository
public class DashboardReportRepository {

    private final ZohoItemCacheService zohoItemCacheService;
    private final DispatchedItemRepository dispatchedRepo;
    private final ZohoStickerHistoryRepository stickerHistoryRepo;

    public DashboardReportRepository(
            ZohoItemCacheService zohoItemCacheService,
            DispatchedItemRepository dispatchedRepo,
            ZohoStickerHistoryRepository stickerHistoryRepo
    ) {
        this.zohoItemCacheService = zohoItemCacheService;
        this.dispatchedRepo = dispatchedRepo;
        this.stickerHistoryRepo = stickerHistoryRepo;
    }

    /** Total Zoho inventory items (≈800) */
    public long countInventoryItems() {
        return zohoItemCacheService.totalCount();
    }

    /** Items currently packed (but not dispatched) */
    public long countPackedItems() {
        return dispatchedRepo.countByStatus(ItemDispatchStatus.PACKED);
    }

    /** Items already dispatched */
    public long countDispatchedItems() {
        return dispatchedRepo.countByStatus(ItemDispatchStatus.DISPATCHED);
    }

    /** Total stickers ever generated */
    public long countStickersGenerated() {
        return stickerHistoryRepo.count();
    }
}
