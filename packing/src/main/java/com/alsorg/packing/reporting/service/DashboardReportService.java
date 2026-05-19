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

        long inventoryItems = repo.countInventoryItems();   // ✅ ZOHO CACHE
        long packedItems = repo.countPackedItems();         // ✅ PACKED
        long dispatchedItems = repo.countDispatchedItems(); // ✅ DISPATCHED
        long stickersGenerated = repo.countStickersGenerated();
        long readyForPacking = inventoryItems - packedItems;
        
        System.out.println("Zoho Inventory Total: " + inventoryItems);
        System.out.println("Packed Items: " + packedItems);
        System.out.println("Ready For Packing: " + readyForPacking);


        return new DashboardStatsDTO(
                readyForPacking,        // <-- THIS WAS WRONG EARLIER
                packedItems,
                dispatchedItems,
                inventoryItems - packedItems, // optional, if needed later
                stickersGenerated
        );
    }

}
