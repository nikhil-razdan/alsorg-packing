package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.scan.ScanResolveResponse;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;

@Service
public class ScannerDispatchService {

    private final PacketItemRepository packetItemRepository;
    private final StickerHistoryRepository stickerHistoryRepository;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final DispatchedItemService dispatchedItemService;
    private final ChalaanPdfService chalaanPdfService;
    private final PlantLocationService plantLocationService;
    private final LogisticsDispatchTripService logisticsDispatchTripService;

    public ScannerDispatchService(
            PacketItemRepository packetItemRepository,
            StickerHistoryRepository stickerHistoryRepository,
            DispatchedItemRepository dispatchedItemRepository,
            DispatchedItemService dispatchedItemService,
            ChalaanPdfService chalaanPdfService,
            PlantLocationService plantLocationService,
            LogisticsDispatchTripService logisticsDispatchTripService) {
        this.packetItemRepository = packetItemRepository;
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.dispatchedItemService = dispatchedItemService;
        this.chalaanPdfService = chalaanPdfService;
        this.plantLocationService = plantLocationService;
        this.logisticsDispatchTripService = logisticsDispatchTripService;
    }

    /*
     * =====================================================
     * RESOLVE ONLY - USED BY FRONTEND BULK SCAN CART
     * =====================================================
     */

    @Transactional(readOnly = true)
    public ScanResolveResponse resolveScan(
            String rawScanText,
            Set<String> allowedPlants) {
        ResolvedScan resolved = resolve(rawScanText);

        PacketItem packetItem = resolved.packetItem;
        DispatchedItem dispatchedItem = resolved.dispatchedItem;

        assertScanPlantAccess(dispatchedItem, allowedPlants);

        boolean dispatchAllowed = canQrDispatchNow(dispatchedItem);

        ScanResolveResponse dto = new ScanResolveResponse();

        dto.setPacketItemId(packetItem.getId().toString());
        dto.setZohoItemId(dispatchedItem.getZohoItemId());
        dto.setStickerNumber(packetItem.getStickerNumber());
        dto.setItemName(packetItem.getItemName());
        dto.setSku(packetItem.getSku());
        dto.setPdNo(packetItem.getPdNo());
        dto.setDrawingNo(packetItem.getDrawingNo());
        dto.setClientName(packetItem.getClientName());
        dto.setDescription(packetItem.getDescription());

        dto.setPlantCode(dispatchedItem.getPlantCode());
        dto.setPackedAreaCode(dispatchedItem.getPackedAreaCode());
        dto.setCurrentLocationCode(dispatchedItem.getCurrentLocationCode());
        dto.setFgAreaCode(dispatchedItem.getFgAreaCode());
        dto.setFgZoneCode(dispatchedItem.getFgZoneCode());

        /*
         * New simplified flow:
         * No forced FG move from mobile scanner.
         * Dispatch user scans, selects driver/vehicle, and dispatches.
         */
        dto.setFgZones(List.of());
        dto.setMoveToFgRequired(false);
        dto.setFgZoneRequired(false);

        dto.setStatus(
                dispatchedItem.getStatus() != null
                        ? dispatchedItem.getStatus().name()
                        : "");

        dto.setDispatchAllowed(dispatchAllowed);

        if (dispatchAllowed) {
            dto.setMessage("Item ready for QR dispatch");
        } else if (dispatchedItem.getStatus() == ItemDispatchStatus.DISPATCHED) {
            dto.setMessage("Item already dispatched");
        } else {
            dto.setMessage(
                    "Item cannot be dispatched from current status: "
                            + dispatchedItem.getStatus());
        }

        return dto;
    }

    /*
     * =====================================================
     * SINGLE QR AUTO DISPATCH
     * =====================================================
     */

    @Transactional
    public DispatchTripPdfResult dispatchSingleByScan(
            String rawScanText,
            String username,
            Set<String> allowedPlants,
            UUID driverId,
            UUID vehicleId,
            LocalDateTime tripStart) {
        ResolvedScan resolved = resolve(rawScanText);

        assertScanPlantAccess(resolved.dispatchedItem, allowedPlants);

        DispatchedItem item = prepareForDispatch(
                resolved.dispatchedItem,
                username);

        return logisticsDispatchTripService
                .createTripAndGenerateChallan(
                        List.of(item.getZohoItemId()),
                        driverId,
                        vehicleId,
                        tripStart,
                        username,
                        "QR_SINGLE");
    }

    /*
     * =====================================================
     * BULK QR AUTO DISPATCH
     * =====================================================
     */

    @Transactional
    public DispatchTripPdfResult dispatchBulkByScans(
            List<String> rawScanTexts,
            String username,
            Set<String> allowedPlants,
            UUID driverId,
            UUID vehicleId,
            LocalDateTime tripStart) {
        if (rawScanTexts == null || rawScanTexts.isEmpty()) {
            throw new RuntimeException("No QR scans provided");
        }

        Map<String, ResolvedScan> unique = new LinkedHashMap<>();

        for (String scanText : rawScanTexts) {
            ResolvedScan resolved = resolve(scanText);

            assertScanPlantAccess(resolved.dispatchedItem, allowedPlants);

            String id = resolved.dispatchedItem.getZohoItemId();

            if (unique.containsKey(id)) {
                throw new RuntimeException(
                        "Duplicate scan found for item: " + resolved.dispatchedItem.getName());
            }

            unique.put(id, resolved);
        }

        List<String> preparedIds = new ArrayList<>();

        for (ResolvedScan resolved : unique.values()) {
            DispatchedItem prepared = prepareForDispatch(
                    resolved.dispatchedItem,
                    username);

            preparedIds.add(prepared.getZohoItemId());
        }

        return logisticsDispatchTripService
                .createTripAndGenerateChallan(
                        preparedIds,
                        driverId,
                        vehicleId,
                        tripStart,
                        username,
                        "QR_BULK");
    }

    /*
     * =====================================================
     * STATUS PREPARATION
     * =====================================================
     */

    private DispatchedItem prepareForDispatch(
            DispatchedItem item,
            String username) {
        if (item.getStatus() == ItemDispatchStatus.LOADED) {
            throw new RuntimeException(
                    "Item is already assigned in old driver flow. Challan: "
                            + safe(item.getChalaanNumber()));
        }

        if (item.getStatus() == ItemDispatchStatus.OUT_FOR_DELIVERY) {
            throw new RuntimeException(
                    "Item is already out for delivery in old flow. Challan: "
                            + safe(item.getChalaanNumber()));
        }

        if (item.getStatus() == ItemDispatchStatus.DELIVERED) {
            throw new RuntimeException(
                    "Item is already delivered in old flow. Challan: "
                            + safe(item.getChalaanNumber()));
        }

        if (item.getStatus() == ItemDispatchStatus.DISPATCHED) {
            throw new RuntimeException(
                    "Item already dispatched. Challan: "
                            + safe(item.getChalaanNumber()));
        }

        if (item.getStatus() == ItemDispatchStatus.READY ||
                item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {
            return item;
        }

        throw new RuntimeException(
                "Item cannot be dispatched from current status: " + item.getStatus());
    }

    /*
     * =====================================================
     * SCAN RESOLUTION
     * =====================================================
     */

    private ResolvedScan resolve(String rawScanText) {

        DecodedScan decoded = decode(rawScanText);

        PacketItem packetItem = resolvePacketItem(decoded);

        validateLatestSticker(decoded, packetItem);

        DispatchedItem dispatchedItem = resolveDispatchedItem(packetItem);

        ResolvedScan resolved = new ResolvedScan();
        resolved.packetItem = packetItem;
        resolved.dispatchedItem = dispatchedItem;
        resolved.decodedScan = decoded;

        return resolved;
    }

    private PacketItem resolvePacketItem(DecodedScan decoded) {

        if (decoded.packetItemId != null) {
            return packetItemRepository.findById(decoded.packetItemId)
                    .orElseThrow(() -> new RuntimeException("Packet item not found"));
        }

        if (decoded.stickerNumber != null && !decoded.stickerNumber.isBlank()) {

            Optional<PacketItem> current = packetItemRepository.findByStickerNumber(decoded.stickerNumber);

            if (current.isPresent()) {
                return current.get();
            }

            Optional<StickerHistory> history = stickerHistoryRepository.findTopByStickerNumberOrderByGeneratedAtDesc(
                    decoded.stickerNumber);

            if (history.isPresent()) {
                return history.get().getPacketItem();
            }
        }

        throw new RuntimeException("Unable to identify item from scanned QR");
    }

    private DispatchedItem resolveDispatchedItem(PacketItem packetItem) {

        Optional<DispatchedItem> byPacketItemId = dispatchedItemRepository.findByPacketItemId(packetItem.getId());

        if (byPacketItemId.isPresent()) {
            return byPacketItemId.get();
        }

        Optional<DispatchedItem> byId = dispatchedItemRepository.findById(packetItem.getId().toString());

        if (byId.isPresent()) {
            return byId.get();
        }

        if (packetItem.getZohoItemId() != null && !packetItem.getZohoItemId().isBlank()) {
            Optional<DispatchedItem> byZoho = dispatchedItemRepository.findById(packetItem.getZohoItemId());

            if (byZoho.isPresent()) {
                return byZoho.get();
            }
        }

        if (packetItem.getStickerNumber() != null && !packetItem.getStickerNumber().isBlank()) {
            Optional<DispatchedItem> bySticker = dispatchedItemRepository
                    .findByStickerNumber(packetItem.getStickerNumber());

            if (bySticker.isPresent()) {
                return bySticker.get();
            }
        }

        throw new RuntimeException("Dispatch record not found for scanned item");
    }

    private void validateLatestSticker(
            DecodedScan decoded,
            PacketItem packetItem) {
        if (decoded.stickerNumber == null || decoded.stickerNumber.isBlank()) {
            return;
        }

        if (packetItem.getStickerNumber() == null || packetItem.getStickerNumber().isBlank()) {
            throw new RuntimeException("Scanned item has no active sticker");
        }

        if (!decoded.stickerNumber.equals(packetItem.getStickerNumber())) {
            throw new RuntimeException(
                    "Old/reprinted sticker scanned. Please scan latest sticker: "
                            + packetItem.getStickerNumber());
        }
    }

    private DecodedScan decode(String rawScanText) {

        if (rawScanText == null || rawScanText.trim().isEmpty()) {
            throw new RuntimeException("Empty QR scan");
        }

        String scanText = URLDecoder.decode(
                rawScanText.trim(),
                StandardCharsets.UTF_8);

        DecodedScan decoded = new DecodedScan();

        // New format:
        // ALSORG|PI=<uuid>|SN=<stickerNumber>
        if (scanText.startsWith("ALSORG|")) {

            String[] parts = scanText.split("\\|");

            for (String part : parts) {
                if (part.startsWith("PI=")) {
                    decoded.packetItemId = UUID.fromString(part.substring(3).trim());
                }

                if (part.startsWith("SN=")) {
                    decoded.stickerNumber = part.substring(3).trim();
                }
            }

            return decoded;
        }

        // Fallback 1: UUID anywhere in scanned text
        Matcher uuidMatcher = Pattern
                .compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
                .matcher(scanText);

        if (uuidMatcher.find()) {
            decoded.packetItemId = UUID.fromString(uuidMatcher.group());
            return decoded;
        }

        // Old QR format fallback:
        // SNo: ALS-000001
        Matcher oldStickerMatcher = Pattern
                .compile("SNo:\\s*([^\\r\\n]+)")
                .matcher(scanText);

        if (oldStickerMatcher.find()) {
            decoded.stickerNumber = oldStickerMatcher.group(1).trim();
            return decoded;
        }

        // Fallback:
        // SN=ALS-000001
        Matcher snMatcher = Pattern
                .compile("SN=([^|\\r\\n\\s]+)")
                .matcher(scanText);

        if (snMatcher.find()) {
            decoded.stickerNumber = snMatcher.group(1).trim();
            return decoded;
        }

        throw new RuntimeException("Invalid QR format");
    }

    /*
     * =====================================================
     * CHALAAN DATA
     * =====================================================
     */

    private ChalaanItem buildChalaanItem(
            DispatchedItem dispatchedItem,
            PacketItem packetItem) {
        ChalaanItem ci = new ChalaanItem();

        ci.setZohoItemId(dispatchedItem.getZohoItemId());

        ci.setItemName(
                packetItem != null && packetItem.getItemName() != null
                        ? packetItem.getItemName()
                        : dispatchedItem.getName());

        ci.setPdNo(
                packetItem != null && packetItem.getPdNo() != null
                        ? packetItem.getPdNo()
                        : dispatchedItem.getPdNo());

        ci.setClientName(
                packetItem != null && packetItem.getClientName() != null
                        ? packetItem.getClientName()
                        : dispatchedItem.getClientName());

        ci.setClientAddress(
                packetItem != null && packetItem.getClientAddress() != null
                        ? packetItem.getClientAddress()
                        : dispatchedItem.getClientAddress());

        ci.setDrawingNo(
                packetItem != null && packetItem.getDrawingNo() != null
                        ? packetItem.getDrawingNo()
                        : dispatchedItem.getDrawingNo());

        ci.setDescription(
                packetItem != null && packetItem.getDescription() != null
                        ? packetItem.getDescription()
                        : dispatchedItem.getDescription());

        ci.setRemarks(
                packetItem != null && packetItem.getRemarks() != null
                        ? packetItem.getRemarks()
                        : dispatchedItem.getRemarks());

        ci.setQty(
                dispatchedItem.getQuantity() != null
                        ? String.valueOf(dispatchedItem.getQuantity())
                        : "1");

        return ci;
    }

    private void assertScanPlantAccess(
            DispatchedItem item,
            Set<String> allowedPlants) {
        if (item == null) {
            throw new RuntimeException("Dispatch item missing");
        }

        if (allowedPlants == null || allowedPlants.isEmpty()) {
            return;
        }

        /*
         * Legacy safety:
         * Old records may not have plantCode.
         */
        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return;
        }

        if (!allowedPlants.contains(item.getPlantCode())) {
            throw new RuntimeException(
                    "User does not have access to plant: " + item.getPlantCode());
        }
    }

    private boolean isLegacyLocationMissing(DispatchedItem item) {
        return item.getPlantCode() == null || item.getPlantCode().isBlank()
                || item.getCurrentLocationCode() == null || item.getCurrentLocationCode().isBlank()
                || item.getFgAreaCode() == null || item.getFgAreaCode().isBlank();
    }

    private String currentLocation(DispatchedItem item) {
        if (item.getCurrentLocationCode() != null && !item.getCurrentLocationCode().isBlank()) {
            return item.getCurrentLocationCode().trim();
        }

        if (item.getLocation() != null && !item.getLocation().isBlank()) {
            return item.getLocation().trim();
        }

        return "";
    }

    private boolean isPkdLocation(DispatchedItem item) {
        String loc = currentLocation(item);

        if (loc.isBlank()) {
            return false;
        }

        String packedArea = item.getPackedAreaCode();

        if (packedArea != null && !packedArea.isBlank()) {
            return loc.equals(packedArea)
                    || loc.startsWith(packedArea + "-")
                    || loc.startsWith(packedArea + " ");
        }

        return loc.startsWith("PKD");
    }

    private boolean isFgLocation(DispatchedItem item) {
        String loc = currentLocation(item);
        String fg = item.getFgAreaCode();

        if (loc.isBlank() || fg == null || fg.isBlank()) {
            return false;
        }

        return loc.equals(fg)
                || loc.startsWith(fg + "-")
                || loc.startsWith(fg + " ");
    }

    private boolean requiresMoveToFg(DispatchedItem item) {
        return item.getStatus() == ItemDispatchStatus.READY
                && !isLegacyLocationMissing(item)
                && isPkdLocation(item)
                && !isFgLocation(item);
    }

    private boolean canQrDispatchNow(DispatchedItem item) {
        return item.getStatus() == ItemDispatchStatus.READY
                || item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH;
    }

    private List<String> getFgZones(DispatchedItem item) {
        if (item == null || item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return List.of();
        }

        try {
            PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(item.getPlantCode());

            return plant.fgZones() != null
                    ? plant.fgZones()
                    : List.of();

        } catch (Exception e) {
            /*
             * Fallback for safety.
             */
            if ("FG-1".equals(item.getFgAreaCode())) {
                return List.of("A", "B", "C");
            }

            return List.of();
        }
    }

    private String generateChalaanNumber() {
        return "CH-" + System.currentTimeMillis();
    }

    private String safe(Object v) {
        if (v == null)
            return "-";
        String s = v.toString().trim();
        return s.isEmpty() ? "-" : s;
    }

    private static class DecodedScan {
        private UUID packetItemId;
        private String stickerNumber;
    }

    private static class ResolvedScan {
        private PacketItem packetItem;
        private DispatchedItem dispatchedItem;
        private DecodedScan decodedScan;
    }
}