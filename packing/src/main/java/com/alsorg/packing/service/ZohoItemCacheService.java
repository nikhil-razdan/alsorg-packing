package com.alsorg.packing.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.controller.dto.ZohoItemUIResponse;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.DispatchedItemRepository;

import jakarta.annotation.PostConstruct;

@Service
public class ZohoItemCacheService {

    private final ZohoInventoryClient zohoInventoryClient;
    private List<ZohoItemDTO> cachedItems = new ArrayList<>();
    private final DispatchedItemRepository dispatchedItemRepository;
    private LocalDate cacheLoadedDate;

    public ZohoItemCacheService(
            ZohoInventoryClient zohoInventoryClient,
            DispatchedItemRepository dispatchedItemRepository
    ) {
        this.zohoInventoryClient = zohoInventoryClient;
        this.dispatchedItemRepository = dispatchedItemRepository;
    }

    /** Load items once (after Zoho sync) */
    public void load(List<ZohoItemDTO> items) {
    	this.cachedItems = items;
    	this.cacheLoadedDate = LocalDate.now();
    	System.out.println(">>> CACHE LOADED WITH " + items.size() + " ITEMS");
    }

    /** Server-side pagination */
    public List<ZohoItemDTO> getPage(int page, int pageSize) {

        if (cachedItems.isEmpty()) {
            return List.of();
        }

        int fromIndex = (page - 1) * pageSize;

        if (fromIndex < 0) {
            fromIndex = 0;
        }

        if (fromIndex >= cachedItems.size()) {
            return List.of();
        }

        int toIndex = Math.min(fromIndex + pageSize, cachedItems.size());
        return cachedItems.subList(fromIndex, toIndex);
    }

    public List<ZohoItemUIResponse> getPageForUI(int page, int pageSize) {

        List<ZohoItemDTO> pageItems =
                getPage(page, pageSize)
                        .stream()
                        .filter(
                                item ->
                                        !dispatchedItemRepository.existsByZohoItemId(
                                                item.getZohoItemId()
                                        )
                        )
                        .toList();

        return pageItems.stream()
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
                    ui.setStock(1);
                    ui.setPacked(false);
                    return ui;
                })
                .toList();
    }

    public int totalCount() {
        return cachedItems.size();
    }

    public boolean isEmpty() {
        return cachedItems.isEmpty();
    }

    @PostConstruct
    public void init() {
        List<ZohoItemDTO> items = zohoInventoryClient.fetchAllItems();
        load(items);
        System.out.println("Zoho cache loaded on startup. Total: " + items.size());
    }

    public ZohoItemDTO findByZohoItemId(String zohoItemId) {
        return cachedItems.stream()
                .filter(
                        item ->
                                zohoItemId != null
                                        && item.getZohoItemId() != null
                                        && item.getZohoItemId().equals(zohoItemId)
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Zoho item not found in cache: " + zohoItemId
                                )
                );
    }

	public LocalDate getCacheLoadedDate() {
		return cacheLoadedDate;
	}
}
