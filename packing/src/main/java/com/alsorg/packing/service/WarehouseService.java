package com.alsorg.packing.service;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.MonthDay;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.imports.ImportPreviewRow;
import com.alsorg.packing.domain.imports.ImportRow;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.opencsv.CSVReader;

@Service
public class WarehouseService {

    private static final Logger log = LoggerFactory.getLogger(WarehouseService.class);

    private static final long MAX_IMPORT_BYTES = 10L * 1024L * 1024L;
    private static final int MAX_IMPORT_ROWS = 5_000;
    private static final int MAX_BULK_ITEMS = 200;
    private static final int MAX_GATE_PASS_LENGTH = 120;
    private static final int MAX_ITEM_ID_LENGTH = 300;

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

    @Transactional(readOnly = true)
    public List<DispatchedItem> getFloorItems(
            Set<String> allowedPlants,
            boolean viewallWarehouseData) {
        if (viewallWarehouseData) {
            return repo.findByStatus(ItemDispatchStatus.ON_FLOOR);
        }

        if (allowedPlants == null || allowedPlants.isEmpty()) {
            return List.of();
        }

        return repo.findByStatusAndPlantCodeIn(
                ItemDispatchStatus.ON_FLOOR,
                allowedPlants);
    }

    @Transactional(readOnly = true)
    public List<DispatchedItem> getWarehouseItems(
            Set<String> allowedPlants,
            boolean viewallWarehouseData) {
        List<ItemDispatchStatus> statuses = List.of(
                ItemDispatchStatus.WAREHOUSE_REQUESTED,
                ItemDispatchStatus.IN_WAREHOUSE,
                ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED);

        if (viewallWarehouseData) {
            return repo.findByStatusIn(statuses);
        }

        if (allowedPlants == null || allowedPlants.isEmpty()) {
            return List.of();
        }

        return repo.findByStatusInAndPlantCodeIn(
                statuses,
                allowedPlants);
    }

    @Transactional
    public void requestWarehouseMove(
            String id,
            String warehouseCode,
            String gatePass,
            String username) {
        String cleanId = cleanRequired(
                id,
                MAX_ITEM_ID_LENGTH,
                "Warehouse item id is required");

        DispatchedItem item = repo.findByIdForLifecycleUpdate(cleanId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Warehouse item not found: " + cleanId));

        if (item.getStatus() != ItemDispatchStatus.ON_FLOOR) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only ON_FLOOR items can request warehouse move");
        }

        String cleanGatePass = cleanRequired(
                gatePass,
                MAX_GATE_PASS_LENGTH,
                "Gate pass is required");

        String cleanWarehouse = normalizeWarehouseCode(warehouseCode);
        validateWarehouseForItem(item, cleanWarehouse);

        item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
        item.setWarehouseCode(cleanWarehouse);
        item.setGatePassNumber(cleanGatePass);
        item.setStoredAt(null);

        repo.save(item);
    }

    public void processImport(
            MultipartFile file,
            String mode,
            String username) {
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Plant code required for warehouse import");
    }

    /**
     * Warehouse import is applied atomically after the preview/confirm step.
     * Every row is validated first; a malformed row cannot leave an import half
     * applied without the caller knowing which rows were skipped.
     */
    @Transactional
    public void processImport(
            MultipartFile file,
            String mode,
            String username,
            String plantCode) {
        String cleanPlantCode = normalizePlantCode(plantCode);
        PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(cleanPlantCode);
        List<ImportRow> rows = parseCsv(file);

        if (rows.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Warehouse import contains no data rows");
        }

        Map<String, String> generatedGatePassByWarehouse = new HashMap<>();
        List<DispatchedItem> pending = new ArrayList<>(rows.size());
        LocalDateTime now = LocalDateTime.now(TimeZoneConfig.APP_ZONE);
        String actor = safeActor(username);

        int rowNumber = 1;

        for (ImportRow row : rows) {
            rowNumber++;

            String itemName = cleanRequired(
                    row.getName(),
                    500,
                    "Row " + rowNumber + ": Name required");

            String warehouseLocation = normalizeWarehouseCode(
                    row.getWarehouseCode());

            if (!plantLocationService.isWarehouseAllowed(
                    cleanPlantCode,
                    warehouseLocation)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Row " + rowNumber
                                + ": Warehouse " + warehouseLocation
                                + " is not allowed for plant " + cleanPlantCode);
            }

            String gatePass = cleanNullable(row.getGatePass());

            if (gatePass != null && gatePass.length() > MAX_GATE_PASS_LENGTH) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Row " + rowNumber + ": Gate pass is too long");
            }

            if (gatePass == null) {
                gatePass = generatedGatePassByWarehouse.computeIfAbsent(
                        warehouseLocation,
                        dispatchedItemService::createGatePassNumber);
            }

            DispatchedItem newItem = new DispatchedItem();
            newItem.setZohoItemId(UUID.randomUUID().toString());
            newItem.setName(itemName);
            newItem.setSku(cleanLimited(row.getSku(), 300));
            newItem.setPdNo(cleanLimited(row.getPdNo(), 300));
            newItem.setDrawingNo(normalizeDwg(cleanLimited(row.getDrawingNo(), 300)));
            newItem.setDescription(cleanLimited(row.getDescription(), 2_000));
            newItem.setClientName(cleanLimited(row.getClientName(), 500));

            newItem.setPlantCode(cleanPlantCode);
            newItem.setPackedAreaCode(plant.packedAreaCode());
            newItem.setFgAreaCode(plant.fgAreaCode());
            newItem.setFgZoneCode(null);

            newItem.setLocation(warehouseLocation);
            newItem.setCurrentLocationCode(warehouseLocation);
            newItem.setWarehouseCode(warehouseLocation);
            newItem.setGatePassNumber(gatePass);
            newItem.setStatus(ItemDispatchStatus.IN_WAREHOUSE);
            newItem.setStock(1);
            newItem.setCreatedBy(actor);
            newItem.setCreatedAt(now);
            newItem.setStoredAt(now);

            pending.add(newItem);
        }

        repo.saveAll(pending);
        log.info(
                "Warehouse import completed: plant={}, rows={}, actor={}",
                cleanPlantCode,
                pending.size(),
                actor);
    }

    private List<ImportRow> parseCsv(
            MultipartFile file) {
        validateImportFile(file);

        List<ImportRow> list = new ArrayList<>();

        try (CSVReader reader = new CSVReader(
                new InputStreamReader(
                        file.getInputStream(),
                        StandardCharsets.UTF_8))) {

            reader.readNext(); // header

            String[] parts;

            while ((parts = reader.readNext()) != null) {
                if (list.size() >= MAX_IMPORT_ROWS) {
                    throw new ResponseStatusException(
                            HttpStatus.PAYLOAD_TOO_LARGE,
                            "Warehouse import cannot exceed "
                                    + MAX_IMPORT_ROWS + " rows");
                }

                ImportRow row = new ImportRow();
                row.setName(value(parts, 0));
                row.setSku(value(parts, 1));
                row.setPdNo(value(parts, 2));
                row.setDrawingNo(normalizeDwg(value(parts, 3)));
                row.setDescription(value(parts, 4));
                row.setClientName(value(parts, 5));
                row.setLocation(value(parts, 6));
                row.setWarehouseCode(value(parts, 7));
                row.setGatePass(value(parts, 8));
                list.add(row);
            }
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "CSV parse failed",
                    exception);
        }

        return list;
    }

    @Transactional(readOnly = true)
    public List<ImportPreviewRow> previewImport(
            MultipartFile file,
            String mode) {
        List<ImportRow> rows = parseCsv(file);
        List<ImportPreviewRow> result = new ArrayList<>(rows.size());

        for (ImportRow row : rows) {
            ImportPreviewRow preview = new ImportPreviewRow();
            preview.setZohoItemId(row.getName());
            preview.setLocation(row.getLocation());
            preview.setWarehouseCode(cleanNullable(row.getWarehouseCode()));
            preview.setGatePass(cleanNullable(row.getGatePass()));

            try {
                cleanRequired(row.getName(), 500, "Name required");
                normalizeWarehouseCode(row.getWarehouseCode());

                if (row.getGatePass() != null
                        && row.getGatePass().trim().length() > MAX_GATE_PASS_LENGTH) {
                    throw new IllegalArgumentException("Gate pass is too long");
                }

                preview.setValid(true);
            } catch (Exception exception) {
                preview.setValid(false);
                preview.setError(exception.getMessage());
            }

            result.add(preview);
        }

        return List.copyOf(result);
    }

    @Transactional
    public void adminRequestReturnToDispatch(
            String itemId,
            String username) {
        String cleanId = cleanRequired(
                itemId,
                MAX_ITEM_ID_LENGTH,
                "Warehouse item id is required");

        DispatchedItem item = repo.findByIdForLifecycleUpdate(cleanId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Warehouse item not found: " + cleanId));

        if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only items currently stored in Warehouse can request Return to Dispatch");
        }

        dispatchedItemService.requestReturnToDispatch(
                cleanId,
                safeActor(username));
    }

    @Transactional
    public int adminBulkRequestReturnToDispatch(
            List<String> itemIds,
            String username) {
        List<String> uniqueIds = cleanUniqueIds(itemIds);
        List<DispatchedItem> locked = loadAndLockBatch(uniqueIds);

        for (DispatchedItem item : locked) {
            if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Bulk Return can only be requested for IN_WAREHOUSE items. Item "
                                + item.getZohoItemId() + " is " + item.getStatus());
            }
        }

        String actor = safeActor(username);
        for (String itemId : uniqueIds) {
            dispatchedItemService.requestReturnToDispatch(itemId, actor);
        }

        return uniqueIds.size();
    }

    @Transactional
    public int adminBulkApproveReturnRequests(
            List<String> itemIds,
            String username) {
        List<String> pendingIds = requirePendingReturnRequestIds(itemIds);
        String actor = safeActor(username);

        for (String itemId : pendingIds) {
            dispatchedItemService.approveReturnToDispatch(itemId, actor);
        }

        return pendingIds.size();
    }

    @Transactional
    public int adminBulkRejectReturnRequests(
            List<String> itemIds,
            String username) {
        List<String> pendingIds = requirePendingReturnRequestIds(itemIds);
        String actor = safeActor(username);

        for (String itemId : pendingIds) {
            dispatchedItemService.rejectReturnToDispatch(itemId, actor);
        }

        return pendingIds.size();
    }

    private List<String> requirePendingReturnRequestIds(
            List<String> itemIds) {
        List<String> uniqueIds = cleanUniqueIds(itemIds);
        List<DispatchedItem> locked = loadAndLockBatch(uniqueIds);

        for (DispatchedItem item : locked) {
            if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Only pending Return to Dispatch requests can be approved/rejected. Item "
                                + item.getZohoItemId() + " is " + item.getStatus());
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
                cleanRequired(itemId, MAX_ITEM_ID_LENGTH, "Warehouse item id is required"),
                normalizePlantCode(plantCode),
                cleanNullable(currentLocationCode),
                cleanNullable(fgZoneCode),
                cleanNullable(warehouseCode),
                safeActor(username));
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
        String cleanPlantCode = normalizePlantCode(plantCode);

        /* Lock/verify all ids before the first mutation. */
        loadAndLockBatch(uniqueIds);

        for (String itemId : uniqueIds) {
            adminEditLocation(
                    itemId,
                    cleanPlantCode,
                    cleanNullable(currentLocationCode),
                    cleanNullable(fgZoneCode),
                    cleanNullable(warehouseCode),
                    username);
        }

        return uniqueIds.size();
    }

    @Transactional
    public int generateMissingGatePassForStoredItems(
            Set<String> allowedPlants,
            boolean viewAllWarehouseData,
            String username) {
        List<DispatchedItem> warehouseItems = getWarehouseItems(
                allowedPlants,
                viewAllWarehouseData);

        Map<String, String> generatedGatePassByWarehouse = new HashMap<>();
        List<DispatchedItem> changedItems = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now(TimeZoneConfig.APP_ZONE);
        String actor = safeActor(username);

        for (DispatchedItem item : warehouseItems) {
            if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {
                continue;
            }

            if (item.getGatePassNumber() != null
                    && !item.getGatePassNumber().trim().isBlank()) {
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
                item.setCreatedBy(actor);
            }

            if (item.getStoredAt() == null) {
                item.setStoredAt(now);
            }

            changedItems.add(item);
        }

        if (!changedItems.isEmpty()) {
            repo.saveAll(changedItems);
        }

        return changedItems.size();
    }

    private List<DispatchedItem> loadAndLockBatch(
            List<String> uniqueIds) {
        if (uniqueIds == null || uniqueIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select at least one warehouse item");
        }

        List<DispatchedItem> locked = repo.findAllByIdForDispatchUpdate(uniqueIds);

        if (locked.size() != uniqueIds.size()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "One or more selected warehouse items no longer exist");
        }

        Map<String, DispatchedItem> byId = new LinkedHashMap<>();
        for (DispatchedItem item : locked) {
            if (item != null && item.getZohoItemId() != null) {
                byId.put(item.getZohoItemId(), item);
            }
        }

        List<DispatchedItem> ordered = new ArrayList<>(uniqueIds.size());
        for (String id : uniqueIds) {
            DispatchedItem item = byId.get(id);
            if (item == null) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Warehouse item not found: " + id);
            }
            ordered.add(item);
        }

        return ordered;
    }

    private List<String> cleanUniqueIds(
            List<String> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select at least one warehouse item");
        }

        LinkedHashSet<String> unique = new LinkedHashSet<>();

        for (String id : itemIds) {
            if (id == null) {
                continue;
            }

            String clean = id.trim();

            if (clean.isBlank()) {
                continue;
            }

            if (clean.length() > MAX_ITEM_ID_LENGTH) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Warehouse item id is too long");
            }

            unique.add(clean);
        }

        if (unique.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select at least one warehouse item");
        }

        if (unique.size() > MAX_BULK_ITEMS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of " + MAX_BULK_ITEMS
                            + " warehouse items can be processed at once");
        }

        return List.copyOf(unique);
    }

    private void validateWarehouseForItem(
            DispatchedItem item,
            String warehouseCode) {
        String plantCode = item == null
                ? null
                : item.getPlantCode();

        if (plantCode == null || plantCode.isBlank()) {
            return; // legacy row compatibility
        }

        String cleanPlant = normalizePlantCode(plantCode);

        if (!plantLocationService.isWarehouseAllowed(
                cleanPlant,
                warehouseCode)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Warehouse " + warehouseCode
                            + " is not allowed for plant " + cleanPlant);
        }
    }

    private void validateImportFile(
            MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "CSV file is required");
        }

        if (file.getSize() > MAX_IMPORT_BYTES) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "CSV file cannot exceed 10 MB");
        }
    }

    private String normalizePlantCode(
            String value) {
        String clean = cleanRequired(
                value,
                40,
                "Plant code required")
                .toUpperCase(Locale.ROOT);

        if (!plantLocationService.isValidPlant(clean)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid plant code: " + clean);
        }

        return clean;
    }

    private String normalizeWarehouseCode(
            String value) {
        String clean = cleanRequired(
                value,
                60,
                "Warehouse required")
                .toUpperCase(Locale.ROOT);

        return clean;
    }

    private String value(
            String[] parts,
            int index) {
        return parts != null && index >= 0 && index < parts.length
                ? parts[index]
                : null;
    }

    private String firstNonBlank(
            String... values) {
        if (values != null) {
            for (String value : values) {
                if (value != null && !value.trim().isBlank()) {
                    return value.trim();
                }
            }
        }

        return "WH";
    }

    private String cleanRequired(
            String value,
            int maxLength,
            String message) {
        String clean = cleanNullable(value);

        if (clean == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    message);
        }

        if (clean.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    message + " (maximum " + maxLength + " characters)");
        }

        return clean;
    }

    private String cleanLimited(
            String value,
            int maxLength) {
        String clean = cleanNullable(value);

        if (clean == null) {
            return null;
        }

        if (clean.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Import value is too long");
        }

        return clean;
    }

    private String cleanNullable(
            String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();

        if (clean.startsWith("\"")
                && clean.endsWith("\"")
                && clean.length() >= 2) {
            clean = clean.substring(1, clean.length() - 1).trim();
        }

        return clean.isBlank() ? null : clean;
    }

    private String safeActor(
            String username) {
        String actor = cleanNullable(username);
        return actor == null ? "SYSTEM" : actor;
    }

    private String normalizeDwg(
            String value) {
        if (value == null || value.isBlank()) {
            return value;
        }

        String clean = value.trim().replaceFirst("^'+", "").trim();

        try {
            if (clean.matches("\\d{2}-[A-Za-z]{3}")) {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern(
                        "dd-MMM",
                        Locale.ENGLISH);
                MonthDay monthDay = MonthDay.parse(clean, formatter);

                return String.format(
                        Locale.ROOT,
                        "%02d/%02d",
                        monthDay.getDayOfMonth(),
                        monthDay.getMonthValue());
            }

            if (clean.matches("\\d{5}")) {
                long serial = Long.parseLong(clean);
                java.time.LocalDate date = java.time.LocalDate
                        .of(1899, 12, 30)
                        .plusDays(serial);

                return String.format(
                        Locale.ROOT,
                        "%02d/%02d",
                        date.getDayOfMonth(),
                        date.getMonthValue());
            }

            if (clean.matches("\\d{2}-\\d{2}")) {
                return clean.replace("-", "/");
            }
        } catch (Exception ignored) {
            /* Keep the original drawing text if an Excel coercion cannot be decoded. */
        }

        return clean;
    }
}
