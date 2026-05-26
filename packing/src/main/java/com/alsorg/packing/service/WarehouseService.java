package com.alsorg.packing.service;

import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import com.opencsv.CSVReader;

import org.springframework.stereotype.Service;
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

    public WarehouseService(
            DispatchedItemRepository repo,
            DispatchedItemService dispatchedItemService
    ) {
        this.repo = repo;
        this.dispatchedItemService = dispatchedItemService;
    }

    public List<DispatchedItem> getFloorItems() {
        return repo.findByStatus(ItemDispatchStatus.ON_FLOOR);
    }

    public List<DispatchedItem> getWarehouseItems() {
        return repo.findByStatusIn(
                List.of(
                        ItemDispatchStatus.WAREHOUSE_REQUESTED,
                        ItemDispatchStatus.IN_WAREHOUSE
                )
        );
    }

    public void requestWarehouseMove(
            String id,
            String warehouseCode,
            String gatePass,
            String username
    ) {

        DispatchedItem item = repo.findById(id).orElseThrow();

        if (item.getStatus() != ItemDispatchStatus.ON_FLOOR) {
            throw new RuntimeException(
                    "Only ON_FLOOR items can request warehouse move"
            );
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
            String username
    ) {

        List<ImportRow> rows = parseCsv(file);

        for (ImportRow row : rows) {

            try {

                // ✅ ALWAYS CREATE NEW ITEM
                DispatchedItem newItem = new DispatchedItem();

                // ✅ Generate internal ID
                newItem.setZohoItemId(UUID.randomUUID().toString());

                // ✅ Excel fields
                newItem.setName(row.getName());
                newItem.setSku(row.getSku());
                newItem.setPdNo(row.getPdNo());
                newItem.setDrawingNo(row.getDrawingNo());
                newItem.setDescription(row.getDescription());
                newItem.setClientName(row.getClientName());

                newItem.setLocation(row.getLocation());
                // warehouseCode should ONLY contain actual location
                newItem.setWarehouseCode(cleanLocation(row.getWarehouseCode()));

                // ✅ Gate pass optional
                newItem.setGatePassNumber(
                        row.getGatePass() == null || row.getGatePass().isBlank()
                                ? null
                                : row.getGatePass().trim()
                );

                // ✅ Warehouse status
                newItem.setStatus(ItemDispatchStatus.IN_WAREHOUSE);

                // ✅ Dates
                newItem.setCreatedAt(LocalDateTime.now());
                newItem.setStoredAt(LocalDateTime.now());

                repo.save(newItem);

            } catch (Exception e) {

                System.out.println(
                        "Import failed for: " + row.getName()
                );

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
            String mode
    ) {

        List<ImportRow> rows = parseCsv(file);

        List<ImportPreviewRow> result = new ArrayList<>();

        for (ImportRow row : rows) {

            ImportPreviewRow preview = new ImportPreviewRow();

           
            preview.setZohoItemId(row.getName());

            preview.setLocation(row.getLocation());
            
            preview.setWarehouseCode(
                    cleanLocation(row.getWarehouseCode())
            );

            preview.setGatePass(row.getGatePass());

            try {

                // ✅ BASIC VALIDATION

                if (
                        row.getName() == null
                                || row.getName().isBlank()
                ) {
                    throw new RuntimeException("Name required");
                }

                if (
                        row.getWarehouseCode() == null
                                || row.getWarehouseCode().isBlank()
                ) {
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

    // =========================================================
    // HELPERS
    // =========================================================

    private String clean(String value) {

        if (value == null) {
            return null;
        }

        value = value.trim();

        if (
                value.startsWith("\"")
                        && value.endsWith("\"")
                        && value.length() >= 2
        ) {
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

        if (value == null || value.isBlank()) return value;

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

                java.time.format.DateTimeFormatter f =
                        java.time.format.DateTimeFormatter.ofPattern("dd-MMM");

                java.time.LocalDate date = java.time.LocalDate.parse(value, f);

                return String.format("%02d/%02d",
                        date.getDayOfMonth(),
                        date.getMonthValue());
            }

            // 🔥 HANDLE EXCEL SERIAL NUMBER (like 46023)
            if (value.matches("\\d{5}")) {

                long serial = Long.parseLong(value);

                java.time.LocalDate date =
                        java.time.LocalDate.of(1899, 12, 30).plusDays(serial);

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