package com.alsorg.packing.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import jakarta.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.ZohoItemUIResponse;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.DispatchedItemRepository;

@Service
public class ZohoItemCacheService {

    private static final Logger log = LoggerFactory.getLogger(ZohoItemCacheService.class);

    private static final int MAX_PAGE_SIZE = 200;
    private static final int MAX_SEARCH_LENGTH = 200;
    private static final int DISPATCH_LOOKUP_CHUNK = 500;

    private final ZohoInventoryClient zohoInventoryClient;
    private final DispatchedItemRepository dispatchedItemRepository;

    private volatile List<ZohoItemDTO> cachedItems = List.of();
    private volatile LocalDate cacheLoadedDate;

    @Value("${zoho.enabled:true}")
    private boolean zohoEnabled;

    public ZohoItemCacheService(
            ZohoInventoryClient zohoInventoryClient,
            DispatchedItemRepository dispatchedItemRepository) {
        this.zohoInventoryClient = zohoInventoryClient;
        this.dispatchedItemRepository = dispatchedItemRepository;
    }

    public synchronized void load(
            List<ZohoItemDTO> items) {
        List<ZohoItemDTO> safeItems = items == null
                ? List.of()
                : items.stream()
                        .filter(item -> item != null)
                        .toList();

        this.cachedItems = List.copyOf(safeItems);
        this.cacheLoadedDate = LocalDate.now(TimeZoneConfig.APP_ZONE);

        log.info("Zoho cache loaded: items={}", safeItems.size());
    }

    @PostConstruct
    public void init() {
        if (!zohoEnabled) {
            log.info("Zoho integration disabled; startup cache load skipped");
            return;
        }

        try {
            load(zohoInventoryClient.fetchAllItems());
        } catch (Exception exception) {
            /*
             * Zoho is an optional integration. Startup must remain available when
             * the external provider is down; the cache can be refreshed later.
             */
            log.warn(
                    "Zoho cache failed to load during startup; application will continue",
                    exception);
        }
    }

    public List<ZohoItemDTO> getPage(
            int page,
            int pageSize) {
        List<ZohoItemDTO> snapshot = cachedItems;

        if (snapshot.isEmpty()) {
            return List.of();
        }

        int safePage = Math.max(page, 1);
        int safePageSize = clampPageSize(pageSize);
        long fromLong = (long) (safePage - 1) * safePageSize;

        if (fromLong >= snapshot.size() || fromLong > Integer.MAX_VALUE) {
            return List.of();
        }

        int fromIndex = (int) fromLong;
        int toIndex = Math.min(fromIndex + safePageSize, snapshot.size());

        return List.copyOf(snapshot.subList(fromIndex, toIndex));
    }

    public List<ZohoItemUIResponse> getPageForUI(
            int page,
            int perPage,
            String search) {
        List<ZohoItemDTO> snapshot = cachedItems;
        String cleanSearch = normalizeSearch(search);
        Set<String> dispatchedIds = dispatchedIdsSnapshot(snapshot);

        List<ZohoItemDTO> filtered = snapshot.stream()
                .filter(item -> !dispatchedIds.contains(item.getZohoItemId()))
                .filter(item -> matchesSearch(item, cleanSearch))
                .toList();

        int safePage = Math.max(page, 1);
        int safePerPage = clampPageSize(perPage);
        long fromLong = (long) (safePage - 1) * safePerPage;

        if (fromLong >= filtered.size() || fromLong > Integer.MAX_VALUE) {
            return List.of();
        }

        int fromIndex = (int) fromLong;
        int toIndex = Math.min(fromIndex + safePerPage, filtered.size());

        return filtered.subList(fromIndex, toIndex)
                .stream()
                .map(this::toUiResponse)
                .toList();
    }

    public int totalCount(
            String search) {
        List<ZohoItemDTO> snapshot = cachedItems;
        String cleanSearch = normalizeSearch(search);
        Set<String> dispatchedIds = dispatchedIdsSnapshot(snapshot);

        long count = snapshot.stream()
                .filter(item -> !dispatchedIds.contains(item.getZohoItemId()))
                .filter(item -> matchesSearch(item, cleanSearch))
                .count();

        return count > Integer.MAX_VALUE
                ? Integer.MAX_VALUE
                : (int) count;
    }

    public int totalCount() {
        return totalCount(null);
    }

    public boolean isEmpty() {
        return cachedItems.isEmpty();
    }

    public LocalDate getCacheLoadedDate() {
        return cacheLoadedDate;
    }

    public ZohoItemDTO findByZohoItemId(
            String zohoItemId) {
        String cleanId = zohoItemId == null
                ? ""
                : zohoItemId.trim();

        if (cleanId.isBlank() || cleanId.length() > 300) {
            throw new IllegalArgumentException("Invalid Zoho item id");
        }

        return cachedItems.stream()
                .filter(item -> cleanId.equals(item.getZohoItemId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Zoho item not found in cache: " + cleanId));
    }

    public synchronized void refreshCache() {
        if (!zohoEnabled) {
            log.info("Zoho integration disabled; cache refresh skipped");
            return;
        }

        try {
            List<ZohoItemDTO> items = zohoInventoryClient.fetchAllItems();
            load(items);
            log.info("Zoho cache refreshed: items={}", items == null ? 0 : items.size());
        } catch (Exception exception) {
            /* Preserve the previous good cache when a refresh fails. */
            log.warn("Zoho cache refresh failed; previous cache retained", exception);
        }
    }

    private Set<String> dispatchedIdsSnapshot(
            List<ZohoItemDTO> snapshot) {
        if (snapshot == null || snapshot.isEmpty()) {
            return Set.of();
        }

        List<String> ids = snapshot.stream()
                .map(ZohoItemDTO::getZohoItemId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        if (ids.isEmpty()) {
            return Set.of();
        }

        Set<String> result = new LinkedHashSet<>();

        for (int start = 0; start < ids.size(); start += DISPATCH_LOOKUP_CHUNK) {
            int end = Math.min(start + DISPATCH_LOOKUP_CHUNK, ids.size());

            for (DispatchedItem item : dispatchedItemRepository.findAllById(
                    ids.subList(start, end))) {
                if (item != null
                        && item.getZohoItemId() != null
                        && !item.getZohoItemId().isBlank()) {
                    result.add(item.getZohoItemId());
                }
            }
        }

        return result;
    }

    private ZohoItemUIResponse toUiResponse(
            ZohoItemDTO item) {
        ZohoItemUIResponse ui = new ZohoItemUIResponse();

        ui.setZohoItemId(item.getZohoItemId());
        ui.setName(item.getName());
        ui.setSku(item.getSku());
        ui.setLocation(nonBlankOrDash(item.getLocation()));
        ui.setClientName(nonBlankOrDash(item.getClientName()));
        ui.setClientAddress(nonBlankOrDash(item.getClientAddress()));
        ui.setDimensions(item.getDimensions());
        ui.setWeight(item.getWeight());
        ui.setStock(1);
        ui.setPacked(false);

        return ui;
    }

    private boolean matchesSearch(
            ZohoItemDTO item,
            String cleanSearch) {
        if (cleanSearch.isBlank()) {
            return true;
        }

        return containsIgnoreCase(item.getName(), cleanSearch)
                || containsIgnoreCase(item.getSku(), cleanSearch);
    }

    private boolean containsIgnoreCase(
            String value,
            String lowerNeedle) {
        return value != null
                && value.toLowerCase(Locale.ROOT).contains(lowerNeedle);
    }

    private String normalizeSearch(
            String search) {
        if (search == null || search.isBlank()) {
            return "";
        }

        String clean = search.trim();

        if (clean.length() > MAX_SEARCH_LENGTH) {
            clean = clean.substring(0, MAX_SEARCH_LENGTH);
        }

        return clean.toLowerCase(Locale.ROOT);
    }

    private int clampPageSize(
            int requested) {
        return Math.max(1, Math.min(requested, MAX_PAGE_SIZE));
    }

    private String nonBlankOrDash(
            String value) {
        return value != null && !value.isBlank()
                ? value
                : "-";
    }
}
