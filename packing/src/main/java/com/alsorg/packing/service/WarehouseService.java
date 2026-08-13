package com.alsorg.packing.service;

import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import com.opencsv.CSVReader;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.alsorg.packing.domain.imports.ImportPreviewRow;
import com.alsorg.packing.domain.imports.ImportRow;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.repository.DispatchedItemRepository;

@Service
public class WarehouseService {

    private final DispatchedItemRepository repo;
    private final DispatchedItemService dispatchedItemService;
    private final PlantLocationService plantLocationService;

    public WarehouseService(
            DispatchedItemRepository repo,
            DispatchedItemService dispatchedItemService,
            PlantLocationService plantLocationService) {
        this.repo = repo;
        this.dispatchedItemService = dispatchedItemService;
        this.plantLocationService = plantLocationService;
    }

    public List<DispatchedItem> getFloorItems(
            java.util.Set<String> allowedPlants,
            boolean viewallWarehouseData) {
        if (viewallWarehouseData) {
            return repo.findByStatus(ItemDispatchStatus.ON_FLOOR);
        }

        return repo.findByStatusAndPlantCodeIn(
                ItemDispatchStatus.ON_FLOOR,
                allowedPlants);
    }

    public List<DispatchedItem> getWarehouseItems(
            java.util.Set<String> allowedPlants,
            boolean viewallWarehouseData) {
        List<ItemDispatchStatus> statuses = List.of(
                ItemDispatchStatus.WAREHOUSE_REQUESTED,
                ItemDispatchStatus.IN_WAREHOUSE,
                ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED);

        if (viewallWarehouseData) {
            return repo.findByStatusIn(statuses);
        }

        return repo.findByStatusInAndPlantCodeIn(
                statuses,
                allowedPlants);
    }

    public void requestWarehouseMove(
            String id,
            String warehouseCode,
            String gatePass,
            String username) {

        DispatchedItem item = repo.findById(id).orElseThrow();

        if (item.getStatus() != ItemDispatchStatus.ON_FLOOR) {
            throw new RuntimeException(
                    "Only ON_FLOOR items can request warehouse move");
        }

        if (gatePass == null || gatePass.isBlank()) {
            throw new RuntimeException("Gate pass is required");
        }

        item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
        item.setWarehouseCode(warehouseCode);
        item.setGatePassNumber(gatePass);
        item.setStoredAt(null);

        repo.save(item);
    }

    public void processImport(
            MultipartFile file,
            String mode,
            String username) {
        throw new RuntimeException("Plant code required for warehouse import");
    }

    public void processImport(
            MultipartFile file,
            String mode,
            String username,
            String plantCode) {

        if (plantCode == null || plantCode.isBlank()) {
            throw new RuntimeException("Plant code required");
        }

        List<ImportRow> rows = parseCsv(file);

        PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

        /*
         * One generated gate pass per warehouse in this import.
         * Example:
         * BLS-WH-1 items get one GP.
         * RTP-WH-2 items get another GP.
         */
        Map<String, String> generatedGatePassByWarehouse = new HashMap<>();

        for (ImportRow row : rows) {

            try {

                DispatchedItem newItem = new DispatchedItem();

                newItem.setZohoItemId(UUID.randomUUID().toString());

                newItem.setName(clean(row.getName()));
                newItem.setSku(clean(row.getSku()));
                newItem.setPdNo(clean(row.getPdNo()));
                newItem.setDrawingNo(normalizeDwg(clean(row.getDrawingNo())));
                newItem.setDescription(clean(row.getDescription()));
                newItem.setClientName(clean(row.getClientName()));

                String warehouseLocation = cleanLocation(row.getWarehouseCode());

                if (warehouseLocation == null || warehouseLocation.isBlank()) {
                    throw new RuntimeException("Warehouse required");
                }

                newItem.setPlantCode(plantCode);
                newItem.setPackedAreaCode(plant.packedAreaCode());
                newItem.setFgAreaCode(plant.fgAreaCode());
                newItem.setFgZoneCode(null);

                newItem.setLocation(warehouseLocation);
                newItem.setCurrentLocationCode(warehouseLocation);
                newItem.setWarehouseCode(warehouseLocation);

                String gatePass;

                if (row.getGatePass() != null && !row.getGatePass().isBlank()) {
                    gatePass = row.getGatePass().trim();
                } else {
                    gatePass = generatedGatePassByWarehouse.computeIfAbsent(
                            warehouseLocation,
                            dispatchedItemService::createGatePassNumber);
                }

                newItem.setGatePassNumber(gatePass);

                newItem.setStatus(ItemDispatchStatus.IN_WAREHOUSE);

                newItem.setStock(1);

                newItem.setCreatedBy(
                        username != null && !username.isBlank()
                                ? username
                                : "SYSTEM");

                newItem.setCreatedAt(LocalDateTime.now());
                newItem.setStoredAt(LocalDateTime.now());

                repo.save(newItem);

            } catch (Exception e) {

                System.out.println("Import failed for: " + row.getName());
                e.printStackTrace();
            }
        }
    }

    private List<ImportRow> parseCsv(MultipartFile file) {

        List<ImportRow> list = new ArrayList<>();

        try (CSVReader reader = new CSVReader(
                new InputStreamReader(file.getInputStream()))) {

            reader.readNext(); // skip header

            String[] parts;

            while ((parts = reader.readNext()) != null) {

                ImportRow r = new ImportRow();

                r.setName(parts.length > 0 ? parts[0] : null);
                r.setSku(parts.length > 1 ? parts[1] : null);
                r.setPdNo(parts.length > 2 ? parts[2] : null);
                r.setDrawingNo(normalizeDwg(parts.length > 3 ? parts[3] : null));
                r.setDescription(parts.length > 4 ? parts[4] : null);
                r.setClientName(parts.length > 5 ? parts[5] : null);
                r.setLocation(parts.length > 6 ? parts[6] : null);
                r.setWarehouseCode(parts.length > 7 ? parts[7] : null);
                r.setGatePass(parts.length > 8 ? parts[8] : null);

                list.add(r);
            }

        } catch (Exception e) {
            throw new RuntimeException("CSV parse failed", e);
        }

        return list;
    }

    public List<ImportPreviewRow> previewImport(
            MultipartFile file,
            String mode) {

        List<ImportRow> rows = parseCsv(file);

        List<ImportPreviewRow> result = new ArrayList<>();

        for (ImportRow row : rows) {

            ImportPreviewRow preview = new ImportPreviewRow();

            preview.setZohoItemId(row.getName());

            preview.setLocation(row.getLocation());

            preview.setWarehouseCode(
                    cleanLocation(row.getWarehouseCode()));

            preview.setGatePass(row.getGatePass());

            try {

                // ✅ BASIC VALIDATION

                if (row.getName() == null
                        || row.getName().isBlank()) {
                    throw new RuntimeException("Name required");
                }

                if (row.getWarehouseCode() == null
                        || row.getWarehouseCode().isBlank()) {
                    throw new RuntimeException("Warehouse required");
                }

                // gate pass optional

                preview.setValid(true);

            } catch (Exception e) {

                preview.setValid(false);
                preview.setError(e.getMessage());
            }

            result.add(preview);
        }

        return result;
    }

    /* =========================================================
     * ADMIN WAREHOUSE OPERATIONS
     * ========================================================= */

    @Transactional
    public void adminRequestReturnToDispatch(
            String itemId,
            String username) {

        DispatchedItem item = repo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Warehouse item not found: " + itemId));

        if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {
            throw new IllegalArgumentException(
                    "Only items currently stored in Warehouse can request Return to Dispatch");
        }

        /*
         * Preserve the ORIGINAL return workflow exactly:
         * IN_WAREHOUSE -> WAREHOUSE_RETURN_REQUESTED.
         * Approval remains a separate Admin action and is NOT auto-executed here.
         */
        dispatchedItemService.requestReturnToDispatch(
                itemId,
                username);
    }

    @Transactional
    public int adminBulkRequestReturnToDispatch(
            List<String> itemIds,
            String username) {

        List<String> uniqueIds = cleanUniqueIds(itemIds);

        if (uniqueIds.isEmpty()) {
            throw new IllegalArgumentException(
                    "Select at least one warehouse item");
        }

        /* Validate the whole batch before the first state change. */
        for (String itemId : uniqueIds) {
            DispatchedItem item = repo.findById(itemId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Warehouse item not found: " + itemId));

            if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {
                throw new IllegalArgumentException(
                        "Bulk Return can only be requested for IN_WAREHOUSE items. " +
                                "Item " + itemId + " is " + item.getStatus());
            }
        }

        for (String itemId : uniqueIds) {
            dispatchedItemService.requestReturnToDispatch(
                    itemId,
                    username);
        }

        return uniqueIds.size();
    }

    /**
     * ADMIN bulk decision for already-requested Warehouse -> Dispatch returns.
     *
     * All rows are validated before the first mutation.  Because this method is
     * transactional, an invalid/missing row cannot leave the selection partially
     * approved.
     */
    @Transactional
    public int adminBulkApproveReturnRequests(
            List<String> itemIds,
            String username) {

        List<String> pendingIds = requirePendingReturnRequestIds(
                itemIds);

        for (String itemId : pendingIds) {
            dispatchedItemService.approveReturnToDispatch(
                    itemId,
                    username);
        }

        return pendingIds.size();
    }

    /**
     * ADMIN bulk rejection for already-requested Warehouse -> Dispatch returns.
     * Restores every validated row to IN_WAREHOUSE through the existing single
     * item service so current audit/activity logging remains unchanged.
     */
    @Transactional
    public int adminBulkRejectReturnRequests(
            List<String> itemIds,
            String username) {

        List<String> pendingIds = requirePendingReturnRequestIds(
                itemIds);

        for (String itemId : pendingIds) {
            dispatchedItemService.rejectReturnToDispatch(
                    itemId,
                    username);
        }

        return pendingIds.size();
    }

    private List<String> requirePendingReturnRequestIds(
            List<String> itemIds) {

        List<String> uniqueIds = cleanUniqueIds(
                itemIds);

        if (uniqueIds.isEmpty()) {
            throw new IllegalArgumentException(
                    "Select at least one return request");
        }

        /*
         * Pre-validate the COMPLETE batch before changing anything.
         */
        for (String itemId : uniqueIds) {
            DispatchedItem item = repo.findById(
                    itemId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Warehouse item not found: " + itemId));

            if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED) {
                throw new IllegalArgumentException(
                        "Only pending Return to Dispatch requests can be approved/rejected. "
                                + "Item " + itemId + " is " + item.getStatus());
            }
        }

        return uniqueIds;
    }

    @Transactional
    public DispatchedItem adminEditLocation(
            String itemId,
            String plantCode,
            String currentLocationCode,
            String fgZoneCode,
            String warehouseCode,
            String username) {

        return dispatchedItemService.assignPlantLocationToDispatchedItem(
                itemId,
                plantCode,
                currentLocationCode,
                fgZoneCode,
                warehouseCode,
                username);
    }

    @Transactional
    public int adminBulkEditLocation(
            List<String> itemIds,
            String plantCode,
            String currentLocationCode,
            String fgZoneCode,
            String warehouseCode,
            String username) {

        List<String> uniqueIds = cleanUniqueIds(itemIds);

        if (uniqueIds.isEmpty()) {
            throw new IllegalArgumentException(
                    "Select at least one warehouse item");
        }

        if (plantCode == null || plantCode.isBlank()) {
            throw new IllegalArgumentException(
                    "Plant code required");
        }

        for (String itemId : uniqueIds) {
            adminEditLocation(
                    itemId,
                    plantCode.trim(),
                    cleanNullable(currentLocationCode),
                    cleanNullable(fgZoneCode),
                    cleanNullable(warehouseCode),
                    username);
        }

        return uniqueIds.size();
    }

    private List<String> cleanUniqueIds(
            List<String> itemIds) {

        if (itemIds == null) {
            return List.of();
        }

        return itemIds.stream()
                .filter(id -> id != null && !id.trim().isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    private String cleanNullable(
            String value) {

        if (value == null) {
            return null;
        }

        String clean = value.trim();
        return clean.isBlank() ? null : clean;
    }

    public int generateMissingGatePassForStoredItems(
            java.util.Set<String> allowedPlants,
            boolean viewAllWarehouseData,
            String username) {
        List<DispatchedItem> warehouseItems = getWarehouseItems(
                allowedPlants,
                viewAllWarehouseData);

        Map<String, String> generatedGatePassByWarehouse = new HashMap<>();

        List<DispatchedItem> changedItems = new ArrayList<>();

        for (DispatchedItem item : warehouseItems) {

            if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {
                continue;
            }

            if (item.getGatePassNumber() != null &&
                    !item.getGatePassNumber().trim().isBlank()) {
                continue;
            }

            String warehouseCode = firstNonBlank(
                    item.getWarehouseCode(),
                    item.getCurrentLocationCode(),
                    item.getLocation(),
                    "WH");

            String gatePass = generatedGatePassByWarehouse.computeIfAbsent(
                    warehouseCode,
                    dispatchedItemService::createGatePassNumber);

            item.setGatePassNumber(gatePass);

            if (item.getCreatedBy() == null || item.getCreatedBy().isBlank()) {
                item.setCreatedBy(
                        username != null && !username.isBlank()
                                ? username
                                : "SYSTEM");
            }

            if (item.getStoredAt() == null) {
                item.setStoredAt(LocalDateTime.now());
            }

            changedItems.add(item);
        }

        if (!changedItems.isEmpty()) {
            repo.saveAll(changedItems);
        }

        return changedItems.size();
    }

    // =========================================================
    // HELPERS
    // =========================================================

    private String firstNonBlank(
            String... values) {
        if (values == null) {
            return "WH";
        }

        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return "WH";
    }

    private String clean(String value) {

        if (value == null) {
            return null;
        }

        value = value.trim();

        if (value.startsWith("\"")
                && value.endsWith("\"")
                && value.length() >= 2) {
            value = value.substring(1, value.length() - 1);
        }

        return value.trim();
    }

    private String cleanLocation(String location) {

        if (location == null) {
            return null;
        }

        location = location.trim();

        // ✅ Prevent accidental wrong mappings
        // if client name/description somehow entered
        // only keep short warehouse-like values

        if (location.length() > 20) {
            return location.substring(0, 20);
        }

        return location;
    }

    private String normalizeDwg(String value) {

        if (value == null || value.isBlank())
            return value;

        value = value.trim();

        // 🔥 REMOVE leading ' (Excel forced text)
        if (value.startsWith("'")) {
            value = value.substring(1).trim();
        }

        // 🔥 ALSO handle cases like "' 04/13"
        if (value.startsWith("'")) {
            value = value.replaceFirst("^'+", "").trim();
        }

        try {
            // Convert "01-Jan" → "01/01"
            if (value.matches("\\d{2}-[A-Za-z]{3}")) {

                java.time.format.DateTimeFormatter f = java.time.format.DateTimeFormatter.ofPattern("dd-MMM");

                java.time.LocalDate date = java.time.LocalDate.parse(value, f);

                return String.format("%02d/%02d",
                        date.getDayOfMonth(),
                        date.getMonthValue());
            }

            // 🔥 HANDLE EXCEL SERIAL NUMBER (like 46023)
            if (value.matches("\\d{5}")) {

                long serial = Long.parseLong(value);

                java.time.LocalDate date = java.time.LocalDate.of(1899, 12, 30).plusDays(serial);

                return String.format("%02d/%02d",
                        date.getDayOfMonth(),
                        date.getMonthValue());
            }

            // 🔥 Convert 04-13 → 04/13 (common Excel behavior)
            if (value.matches("\\d{2}-\\d{2}")) {
                return value.replace("-", "/");
            }

        } catch (Exception ignored) {
        }

        return value;
    }
}