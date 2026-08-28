package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.scan.ScanResolveResponse;
import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.StickerHistoryRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ScannerDispatchService {

    private static final int MAX_SCAN_TEXT_LENGTH = 4096;
    private static final int MAX_BULK_SCANS = 1000;

    private static final Pattern UUID_PATTERN = Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private static final Pattern LEGACY_STICKER_PATTERN = Pattern.compile(
            "SNo:\\s*([^\\r\\n]+)");

    private static final Pattern STICKER_NUMBER_PATTERN = Pattern.compile(
            "SN=([^|\\r\\n\\s]+)");


    private final PacketItemRepository packetItemRepository;
    private final StickerHistoryRepository stickerHistoryRepository;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final PlantLocationService plantLocationService;
    private final DispatchChallanService dispatchChallanService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private UtlWorkflowService utlWorkflowService;

    public ScannerDispatchService(
            PacketItemRepository packetItemRepository,
            StickerHistoryRepository stickerHistoryRepository,
            DispatchedItemRepository dispatchedItemRepository,
            PlantLocationService plantLocationService,
            DispatchChallanService dispatchChallanService) {
        this.packetItemRepository = packetItemRepository;
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.plantLocationService = plantLocationService;
        this.dispatchChallanService = dispatchChallanService;
    }

    @Transactional(readOnly = true)
    public ScanResolveResponse resolveScan(
            String rawScanText,
            Set<String> allowedPlants) {
        ResolvedScan resolved = resolve(rawScanText);

        PacketItem packetItem = resolved.packetItem;

        DispatchedItem dispatchedItem = resolved.dispatchedItem;

        assertScanPlantAccess(
                dispatchedItem,
                allowedPlants);

        boolean moveToFgRequired = requiresMoveToFg(dispatchedItem);

        boolean dispatchAllowed = canQrDispatchNow(dispatchedItem);

        List<String> fgZones = getFgZones(dispatchedItem);

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

        dto.setFgZones(fgZones);
        dto.setMoveToFgRequired(moveToFgRequired);
        dto.setFgZoneRequired(moveToFgRequired && !fgZones.isEmpty());

        dto.setStatus(
                dispatchedItem.getStatus() != null
                        ? dispatchedItem.getStatus().name()
                        : "");

        dto.setDispatchAllowed(dispatchAllowed);

        if (moveToFgRequired) {
            dto.setMessage(
                    fgZones.isEmpty()
                            ? "Move item to FG before QR dispatch"
                            : "Move item to FG before QR dispatch. Select FG zone.");
        } else if (dispatchAllowed) {
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

    /**
     * Backward-compatible overload used by older callers.
     */
    @Transactional
    public DispatchTripPdfResult dispatchSingleByScan(
            String rawScanText,
            String username,
            Set<String> allowedPlants,
            UUID driverId,
            UUID vehicleId,
            LocalDateTime dispatchTime) {

        return dispatchSingleByScan(
                rawScanText,
                username,
                allowedPlants,
                driverId,
                vehicleId,
                dispatchTime,
                null);
    }

    /**
     * Scanner single-item dispatch.
     *
     * helperLoaderCount is deliberately forwarded to DispatchChallanService so
     * the value is persisted on DispatchedItem and printed in the PDF.
     */
    @Transactional
    public DispatchTripPdfResult dispatchSingleByScan(
            String rawScanText,
            String username,
            Set<String> allowedPlants,
            UUID driverId,
            UUID vehicleId,
            LocalDateTime dispatchTime,
            Integer helperLoaderCount) {

        ResolvedScan resolved = resolve(rawScanText);

        assertScanPlantAccess(
                resolved.dispatchedItem,
                allowedPlants);

        return dispatchChallanService.generateAndDispatch(
                List.of(resolved.dispatchedItem.getZohoItemId()),
                driverId,
                vehicleId,
                dispatchTime,
                helperLoaderCount,
                username,
                allowedPlants);
    }

    /**
     * Backward-compatible overload used by older callers.
     */
    @Transactional
    public DispatchTripPdfResult dispatchBulkByScans(
            List<String> rawScanTexts,
            String username,
            Set<String> allowedPlants,
            UUID driverId,
            UUID vehicleId,
            LocalDateTime dispatchTime) {

        return dispatchBulkByScans(
                rawScanTexts,
                username,
                allowedPlants,
                driverId,
                vehicleId,
                dispatchTime,
                null);
    }

    /**
     * Scanner bulk dispatch.
     *
     * QR and manually-entered SN=<stickerNumber> values are resolved through the
     * exact same validation path. Driver/vehicle/helper-loader fields are optional.
     */
    @Transactional
    public DispatchTripPdfResult dispatchBulkByScans(
            List<String> rawScanTexts,
            String username,
            Set<String> allowedPlants,
            UUID driverId,
            UUID vehicleId,
            LocalDateTime dispatchTime,
            Integer helperLoaderCount) {

        if (rawScanTexts == null || rawScanTexts.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No QR / sticker scans provided");
        }

        if (rawScanTexts.size() > MAX_BULK_SCANS) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "A maximum of " + MAX_BULK_SCANS
                            + " scans can be submitted at one time");
        }

        Map<String, ResolvedScan> unique = new LinkedHashMap<>();

        for (String scanText : rawScanTexts) {
            ResolvedScan resolved = resolve(scanText);

            assertScanPlantAccess(
                    resolved.dispatchedItem,
                    allowedPlants);

            String id = resolved.dispatchedItem.getZohoItemId();

            if (unique.containsKey(id)) {
                throw new RuntimeException(
                        "Duplicate scan found for item: "
                                + resolved.dispatchedItem.getName());
            }

            unique.put(id, resolved);
        }

        List<String> itemIds = unique.values()
                .stream()
                .map(resolved -> resolved.dispatchedItem.getZohoItemId())
                .toList();

        return dispatchChallanService.generateAndDispatch(
                itemIds,
                driverId,
                vehicleId,
                dispatchTime,
                helperLoaderCount,
                username,
                allowedPlants);
    }

    private ResolvedScan resolve(
            String rawScanText) {
        DecodedScan decoded = decode(rawScanText);

        PacketItem packetItem = resolvePacketItem(decoded);

        validateLatestSticker(
                decoded,
                packetItem);

        DispatchedItem dispatchedItem = resolveDispatchedItem(packetItem);

        ResolvedScan resolved = new ResolvedScan();

        resolved.packetItem = packetItem;
        resolved.dispatchedItem = dispatchedItem;
        resolved.decodedScan = decoded;

        return resolved;
    }

    private PacketItem resolvePacketItem(
            DecodedScan decoded) {
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
                PacketItem historicalPacket = history.get().getPacketItem();

                if (historicalPacket != null) {
                    return historicalPacket;
                }
            }
        }

        throw new RuntimeException("Unable to identify item from scanned QR");
    }

    private DispatchedItem resolveDispatchedItem(
            PacketItem packetItem) {
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

    private DecodedScan decode(
            String rawScanText) {
        if (rawScanText == null || rawScanText.trim().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Empty QR scan");
        }

        String trimmed = rawScanText.trim();

        if (trimmed.length() > MAX_SCAN_TEXT_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "QR / sticker scan is too large");
        }

        final String scanText;

        try {
            scanText = URLDecoder.decode(
                    trimmed,
                    StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid URL-encoded QR data");
        }

        if (scanText.length() > MAX_SCAN_TEXT_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "Decoded QR / sticker scan is too large");
        }

        DecodedScan decoded = new DecodedScan();

        if (scanText.startsWith("ALSORG|")) {
            String[] parts = scanText.split("\\|");

            for (String part : parts) {
                if (part.startsWith("PI=")) {
                    decoded.packetItemId = parseUuid(
                            part.substring(3).trim());
                }

                if (part.startsWith("SN=")) {
                    decoded.stickerNumber = part.substring(3).trim();
                }
            }

            return decoded;
        }

        Matcher uuidMatcher = UUID_PATTERN.matcher(scanText);

        if (uuidMatcher.find()) {
            decoded.packetItemId = parseUuid(
                    uuidMatcher.group());

            return decoded;
        }

        Matcher oldStickerMatcher = LEGACY_STICKER_PATTERN.matcher(scanText);

        if (oldStickerMatcher.find()) {
            decoded.stickerNumber = oldStickerMatcher.group(1).trim();

            return decoded;
        }

        Matcher snMatcher = STICKER_NUMBER_PATTERN.matcher(scanText);

        if (snMatcher.find()) {
            decoded.stickerNumber = snMatcher.group(1).trim();

            return decoded;
        }

        throw new RuntimeException("Invalid QR format");
    }

    private UUID parseUuid(
            String value) {

        try {
            return UUID.fromString(value);
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid packet item identifier in QR");
        }
    }

    private void assertScanPlantAccess(
            DispatchedItem item,
            Set<String> allowedPlants) {
        if (item == null) {
            throw new RuntimeException("Dispatch item missing");
        }

        if (utlWorkflowService != null) {
            utlWorkflowService.assertCurrentUserCanOperate(item);
        }

        if (allowedPlants == null || allowedPlants.isEmpty()) {
            return;
        }

        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return;
        }

        boolean permitted = allowedPlants.stream()
                .filter(Objects::nonNull)
                .anyMatch(value -> value.trim()
                        .equalsIgnoreCase(
                                item.getPlantCode().trim()));

        if (!permitted) {
            throw new AccessDeniedException(
                    "User does not have access to plant: " + item.getPlantCode());
        }
    }

    private boolean isLegacyLocationMissing(
            DispatchedItem item) {
        return item.getPlantCode() == null || item.getPlantCode().isBlank()
                || item.getCurrentLocationCode() == null || item.getCurrentLocationCode().isBlank()
                || item.getFgAreaCode() == null || item.getFgAreaCode().isBlank();
    }

    private String currentLocation(
            DispatchedItem item) {
        if (item.getCurrentLocationCode() != null && !item.getCurrentLocationCode().isBlank()) {
            return item.getCurrentLocationCode().trim();
        }

        if (item.getLocation() != null && !item.getLocation().isBlank()) {
            return item.getLocation().trim();
        }

        return "";
    }

    private boolean isPkdLocation(
            DispatchedItem item) {
        String location = currentLocation(item);

        if (location.isBlank()) {
            return false;
        }

        String packedArea = item.getPackedAreaCode();

        if (packedArea != null && !packedArea.isBlank()) {
            return location.equals(packedArea)
                    || location.startsWith(packedArea + "-")
                    || location.startsWith(packedArea + " ");
        }

        return location.startsWith("PKD");
    }

    private boolean isFgLocation(
            DispatchedItem item) {
        String location = currentLocation(item);

        String fg = item.getFgAreaCode();

        if (location.isBlank() || fg == null || fg.isBlank()) {
            return false;
        }

        return location.equals(fg)
                || location.startsWith(fg + "-")
                || location.startsWith(fg + " ");
    }

    private boolean requiresMoveToFg(
            DispatchedItem item) {
        return item.getStatus() == ItemDispatchStatus.READY
                && !isLegacyLocationMissing(item)
                && isPkdLocation(item)
                && !isFgLocation(item);
    }

    private boolean canQrDispatchNow(
            DispatchedItem item) {
        if (item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {
            return true;
        }

        if (item.getStatus() == ItemDispatchStatus.READY) {
            return isLegacyLocationMissing(item) || isFgLocation(item);
        }

        return false;
    }

    private List<String> getFgZones(
            DispatchedItem item) {
        if (item == null) {
            return List.of();
        }

        String plantCode = item.getPlantCode() == null
                ? ""
                : item.getPlantCode().trim();

        String fgAreaCode = item.getFgAreaCode() == null
                ? ""
                : item.getFgAreaCode().trim();

        if (!plantCode.isBlank()) {
            try {
                PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

                if (plant.fgZones() != null && !plant.fgZones().isEmpty()) {
                    return plant.fgZones();
                }
            } catch (Exception ignored) {
            }
        }

        if ("AL-P1".equalsIgnoreCase(plantCode)
                || "FG-1".equalsIgnoreCase(fgAreaCode)) {
            return List.of("A", "B", "C");
        }

        return List.of();
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