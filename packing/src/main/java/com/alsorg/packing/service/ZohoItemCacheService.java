package com.alsorg.packing.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.alsorg.packing.controller.dto.ZohoItemUIResponse;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.DispatchedItemRepository;

@Service
public class ZohoItemCacheService {

    private final ZohoInventoryClient zohoInventoryClient;
    private final DispatchedItemRepository dispatchedItemRepository;

    private List<ZohoItemDTO> cachedItems = new ArrayList<>();
    private LocalDate cacheLoadedDate;

    /**
     * Controlled via application-*.yml
     * Default = true (safe)
     */
    @Value("${zoho.enabled:true}")
    private boolean zohoEnabled;

    public ZohoItemCacheService(
            ZohoInventoryClient zohoInventoryClient,
            DispatchedItemRepository dispatchedItemRepository
    ) {
        this.zohoInventoryClient = zohoInventoryClient;
        this.dispatchedItemRepository = dispatchedItemRepository;
    }

    /* ===============================
       CACHE LOAD
       =============================== */

    public void load(List<ZohoItemDTO> items) {
        this.cachedItems = items;
        this.cacheLoadedDate = LocalDate.now();
        System.out.println(">>> CACHE LOADED WITH " + items.size() + " ITEMS");
    }

    /* ===============================
       STARTUP INITIALIZATION
       =============================== */

    @PostConstruct
    public void init() {

        if (!zohoEnabled) {
            System.out.println("Zoho integration disabled via config. Skipping cache load.");
            return;
        }

        try {
            System.out.println("Loading Zoho items on startup...");
            List<ZohoItemDTO> items = zohoInventoryClient.fetchAllItems();
            load(items);
            System.out.println("Zoho cache loaded on startup. Total: " + items.size());
        } catch (Exception ex) {
            System.err.println("⚠ Zoho cache failed to load. Application will continue.");
            ex.printStackTrace();
        }
    }

    /* ===============================
       PAGINATION (BACKEND)
       =============================== */

    public List<ZohoItemDTO> getPage(int page, int pageSize) {

        if (cachedItems.isEmpty()) {
            return List.of();
        }

        int fromIndex = Math.max((page - 1) * pageSize, 0);

        if (fromIndex >= cachedItems.size()) {
            return List.of();
        }

        int toIndex = Math.min(fromIndex + pageSize, cachedItems.size());
        return cachedItems.subList(fromIndex, toIndex);
    }

    /* ===============================
       PAGINATION (UI)
       =============================== */

    public List<ZohoItemUIResponse> getPageForUI(int page, int perPage, String search) {

        // 🔥 STEP 1: REMOVE DISPATCHED ITEMS
        List<ZohoItemDTO> filtered = cachedItems.stream()
            .filter(item ->
                !dispatchedItemRepository.existsByZohoItemId(
                    item.getZohoItemId()
                )
            )
            .toList();

        // 🔥 STEP 2: APPLY SEARCH (NEW)
        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();

            filtered = filtered.stream()
                .filter(item ->
                    (item.getName() != null && item.getName().toLowerCase().contains(s)) ||
                    (item.getSku() != null && item.getSku().toLowerCase().contains(s))
                )
                .toList();
        }

        // 🔥 STEP 3: PAGINATION (FIXED VARIABLE BUG HERE)
        int fromIndex = Math.max((page - 1) * perPage, 0);

        if (fromIndex >= filtered.size()) {
            return List.of();
        }

        int toIndex = Math.min(fromIndex + perPage, filtered.size());

        // 🔥 STEP 4: MAP TO UI RESPONSE
        return filtered.subList(fromIndex, toIndex).stream()
            .map(item -> {
                ZohoItemUIResponse ui = new ZohoItemUIResponse();

                ui.setZohoItemId(item.getZohoItemId());
                ui.setName(item.getName());
                ui.setSku(item.getSku());

                ui.setLocation(
                    item.getLocation() != null && !item.getLocation().isBlank()
                        ? item.getLocation()
                        : "-"
                );

                ui.setClientName(
                    item.getClientName() != null && !item.getClientName().isBlank()
                        ? item.getClientName()
                        : "-"
                );

                ui.setClientAddress(
                    item.getClientAddress() != null && !item.getClientAddress().isBlank()
                        ? item.getClientAddress()
                        : "-"
                );

                ui.setDimensions(item.getDimensions());
                ui.setWeight(item.getWeight());

                ui.setStock(1);
                ui.setPacked(false);

                return ui;
            })
            .toList();
    }

    /* ===============================
       HELPERS
       =============================== */

    public int totalCount(String search) {

        List<ZohoItemDTO> filtered = cachedItems.stream()
            .filter(item ->
                !dispatchedItemRepository.existsByZohoItemId(
                    item.getZohoItemId()
                )
            )
            .toList();

        // 🔥 APPLY SEARCH
        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();

            filtered = filtered.stream()
                .filter(item ->
                    (item.getName() != null && item.getName().toLowerCase().contains(s)) ||
                    (item.getSku() != null && item.getSku().toLowerCase().contains(s))
                )
                .toList();
        }

        return filtered.size();
    }
    
    public int totalCount() {
        return totalCount(null); // 🔥 default = no search
    }

    public boolean isEmpty() {
        return cachedItems.isEmpty();
    }

    public LocalDate getCacheLoadedDate() {
        return cacheLoadedDate;
    }

    public ZohoItemDTO findByZohoItemId(String zohoItemId) {
        return cachedItems.stream()
                .filter(item ->
                        zohoItemId != null
                                && item.getZohoItemId() != null
                                && item.getZohoItemId().equals(zohoItemId)
                )
                .findFirst()
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Zoho item not found in cache: " + zohoItemId
                        )
                );
    }
    
    public synchronized void refreshCache() {
        try {
            System.out.println("🔄 Refreshing Zoho cache...");

            List<ZohoItemDTO> items = zohoInventoryClient.fetchAllItems();
            load(items);

            System.out.println("✅ Zoho cache refreshed: " + items.size());

        } catch (Exception ex) {
            System.err.println("❌ Zoho cache refresh failed");
            ex.printStackTrace();
        }
    }
}