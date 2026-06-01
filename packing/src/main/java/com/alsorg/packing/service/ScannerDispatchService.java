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

@Service
public class ScannerDispatchService {

    private final PacketItemRepository packetItemRepository;
    private final StickerHistoryRepository stickerHistoryRepository;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final DispatchedItemService dispatchedItemService;
    private final ChalaanPdfService chalaanPdfService;

    public ScannerDispatchService(
            PacketItemRepository packetItemRepository,
            StickerHistoryRepository stickerHistoryRepository,
            DispatchedItemRepository dispatchedItemRepository,
            DispatchedItemService dispatchedItemService,
            ChalaanPdfService chalaanPdfService
    ) {
        this.packetItemRepository = packetItemRepository;
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.dispatchedItemService = dispatchedItemService;
        this.chalaanPdfService = chalaanPdfService;
    }

    /* =====================================================
       RESOLVE ONLY - USED BY FRONTEND BULK SCAN CART
       ===================================================== */

    @Transactional(readOnly = true)
    public ScanResolveResponse resolveScan(String rawScanText) {

        ResolvedScan resolved = resolve(rawScanText);

        PacketItem packetItem = resolved.packetItem;
        DispatchedItem dispatchedItem = resolved.dispatchedItem;

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
        dto.setStatus(dispatchedItem.getStatus() != null ? dispatchedItem.getStatus().name() : "");

        boolean allowed =
                dispatchedItem.getStatus() == ItemDispatchStatus.READY
                        || dispatchedItem.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH;

        dto.setDispatchAllowed(allowed);

        if (allowed) {
            dto.setMessage("Item ready for QR dispatch");
        } else if (dispatchedItem.getStatus() == ItemDispatchStatus.DISPATCHED) {
            dto.setMessage("Item already dispatched");
        } else {
            dto.setMessage("Item cannot be dispatched from current status: " + dispatchedItem.getStatus());
        }

        return dto;
    }

    /* =====================================================
       SINGLE QR AUTO DISPATCH
       ===================================================== */

    @Transactional
    public byte[] dispatchSingleByScan(String rawScanText, String username) {

        ResolvedScan resolved = resolve(rawScanText);

        DispatchedItem item = prepareForDispatch(resolved.dispatchedItem, username);

        String chalaanNo = generateChalaanNumber();

        ChalaanPdfData data = new ChalaanPdfData();
        data.setVoucherNo(chalaanNo);
        data.setDesignerName("-");
        data.setOt("-");

        ChalaanItem chalaanItem = buildChalaanItem(item, resolved.packetItem);
        data.setItems(List.of(chalaanItem));
        data.setAddress(safe(chalaanItem.getClientAddress()));

        byte[] pdf = chalaanPdfService.generateChalaan(data);

        item.setChalaanNumber(chalaanNo);
        dispatchedItemRepository.save(item);

        dispatchedItemService.markDispatchedFromChalaan(
                item.getZohoItemId(),
                username
        );

        return pdf;
    }

    /* =====================================================
       BULK QR AUTO DISPATCH
       ===================================================== */

    @Transactional
    public byte[] dispatchBulkByScans(List<String> rawScanTexts, String username) {

        if (rawScanTexts == null || rawScanTexts.isEmpty()) {
            throw new RuntimeException("No QR scans provided");
        }

        Map<String, ResolvedScan> unique = new LinkedHashMap<>();

        for (String scanText : rawScanTexts) {
            ResolvedScan resolved = resolve(scanText);

            String id = resolved.dispatchedItem.getZohoItemId();

            if (unique.containsKey(id)) {
                throw new RuntimeException(
                        "Duplicate scan found for item: " + resolved.dispatchedItem.getName()
                );
            }

            unique.put(id, resolved);
        }

        List<ResolvedScan> resolvedList = new ArrayList<>(unique.values());

        List<DispatchedItem> preparedItems = new ArrayList<>();

        for (ResolvedScan resolved : resolvedList) {
            DispatchedItem prepared =
                    prepareForDispatch(resolved.dispatchedItem, username);

            preparedItems.add(prepared);
        }

        String chalaanNo = generateChalaanNumber();

        ChalaanPdfData data = new ChalaanPdfData();
        data.setVoucherNo(chalaanNo);
        data.setDesignerName("-");
        data.setOt("-");

        List<ChalaanItem> chalaanItems = new ArrayList<>();

        for (ResolvedScan resolved : resolvedList) {
            DispatchedItem latest =
                    dispatchedItemRepository.findById(resolved.dispatchedItem.getZohoItemId())
                            .orElseThrow(() -> new RuntimeException("Item missing after status update"));

            chalaanItems.add(
                    buildChalaanItem(latest, resolved.packetItem)
            );
        }

        data.setItems(chalaanItems);

        if (!chalaanItems.isEmpty()) {
            data.setAddress(safe(chalaanItems.get(0).getClientAddress()));
        }

        byte[] pdf = chalaanPdfService.generateChalaan(data);

        for (DispatchedItem item : preparedItems) {
            item.setChalaanNumber(chalaanNo);
        }

        dispatchedItemRepository.saveAll(preparedItems);

        for (DispatchedItem item : preparedItems) {
            dispatchedItemService.markDispatchedFromChalaan(
                    item.getZohoItemId(),
                    username
            );
        }

        return pdf;
    }

    /* =====================================================
       STATUS PREPARATION
       ===================================================== */

    private DispatchedItem prepareForDispatch(
            DispatchedItem item,
            String username
    ) {
        if (item.getStatus() == ItemDispatchStatus.DISPATCHED) {
            throw new RuntimeException(
                    "Item already dispatched. Challan: "
                            + safe(item.getChalaanNumber())
            );
        }

        if (item.getStatus() == ItemDispatchStatus.READY) {
            dispatchedItemService.updateDispatchStatus(
                    item.getZohoItemId(),
                    ItemDispatchStatus.READY_TO_DISPATCH,
                    username
            );

            return dispatchedItemRepository.findById(item.getZohoItemId())
                    .orElseThrow(() -> new RuntimeException("Item missing after status update"));
        }

        if (item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {
            return item;
        }

        throw new RuntimeException(
                "Item cannot be dispatched from current status: " + item.getStatus()
        );
    }

    /* =====================================================
       SCAN RESOLUTION
       ===================================================== */

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

            Optional<PacketItem> current =
                    packetItemRepository.findByStickerNumber(decoded.stickerNumber);

            if (current.isPresent()) {
                return current.get();
            }

            Optional<StickerHistory> history =
                    stickerHistoryRepository.findTopByStickerNumberOrderByGeneratedAtDesc(
                            decoded.stickerNumber
                    );

            if (history.isPresent()) {
                return history.get().getPacketItem();
            }
        }

        throw new RuntimeException("Unable to identify item from scanned QR");
    }

    private DispatchedItem resolveDispatchedItem(PacketItem packetItem) {

        Optional<DispatchedItem> byPacketItemId =
                dispatchedItemRepository.findByPacketItemId(packetItem.getId());

        if (byPacketItemId.isPresent()) {
            return byPacketItemId.get();
        }

        Optional<DispatchedItem> byId =
                dispatchedItemRepository.findById(packetItem.getId().toString());

        if (byId.isPresent()) {
            return byId.get();
        }

        if (packetItem.getZohoItemId() != null && !packetItem.getZohoItemId().isBlank()) {
            Optional<DispatchedItem> byZoho =
                    dispatchedItemRepository.findById(packetItem.getZohoItemId());

            if (byZoho.isPresent()) {
                return byZoho.get();
            }
        }

        if (packetItem.getStickerNumber() != null && !packetItem.getStickerNumber().isBlank()) {
            Optional<DispatchedItem> bySticker =
                    dispatchedItemRepository.findByStickerNumber(packetItem.getStickerNumber());

            if (bySticker.isPresent()) {
                return bySticker.get();
            }
        }

        throw new RuntimeException("Dispatch record not found for scanned item");
    }

    private void validateLatestSticker(
            DecodedScan decoded,
            PacketItem packetItem
    ) {
        if (decoded.stickerNumber == null || decoded.stickerNumber.isBlank()) {
            return;
        }

        if (packetItem.getStickerNumber() == null || packetItem.getStickerNumber().isBlank()) {
            throw new RuntimeException("Scanned item has no active sticker");
        }

        if (!decoded.stickerNumber.equals(packetItem.getStickerNumber())) {
            throw new RuntimeException(
                    "Old/reprinted sticker scanned. Please scan latest sticker: "
                            + packetItem.getStickerNumber()
            );
        }
    }

    private DecodedScan decode(String rawScanText) {

        if (rawScanText == null || rawScanText.trim().isEmpty()) {
            throw new RuntimeException("Empty QR scan");
        }

        String scanText = URLDecoder.decode(
                rawScanText.trim(),
                StandardCharsets.UTF_8
        );

        DecodedScan decoded = new DecodedScan();

        // New format:
        // ALSORG|PI=<uuid>|SN=<stickerNumber>
        if (scanText.startsWith("ALSORG|")) {

            String[] parts = scanText.split("\\|");

            for (String part : parts) {
                if (part.startsWith("PI=")) {
                    decoded.packetItemId =
                            UUID.fromString(part.substring(3).trim());
                }

                if (part.startsWith("SN=")) {
                    decoded.stickerNumber =
                            part.substring(3).trim();
                }
            }

            return decoded;
        }

        // Fallback 1: UUID anywhere in scanned text
        Matcher uuidMatcher = Pattern
                .compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
                .matcher(scanText);

        if (uuidMatcher.find()) {
            decoded.packetItemId =
                    UUID.fromString(uuidMatcher.group());
            return decoded;
        }

        // Old QR format fallback:
        // SNo: ALS-000001
        Matcher oldStickerMatcher = Pattern
                .compile("SNo:\\s*([^\\r\\n]+)")
                .matcher(scanText);

        if (oldStickerMatcher.find()) {
            decoded.stickerNumber =
                    oldStickerMatcher.group(1).trim();
            return decoded;
        }

        // Fallback:
        // SN=ALS-000001
        Matcher snMatcher = Pattern
                .compile("SN=([^|\\r\\n\\s]+)")
                .matcher(scanText);

        if (snMatcher.find()) {
            decoded.stickerNumber =
                    snMatcher.group(1).trim();
            return decoded;
        }

        throw new RuntimeException("Invalid QR format");
    }

    /* =====================================================
       CHALAAN DATA
       ===================================================== */

    private ChalaanItem buildChalaanItem(
            DispatchedItem dispatchedItem,
            PacketItem packetItem
    ) {
        ChalaanItem ci = new ChalaanItem();

        ci.setZohoItemId(dispatchedItem.getZohoItemId());

        ci.setItemName(
                packetItem != null && packetItem.getItemName() != null
                        ? packetItem.getItemName()
                        : dispatchedItem.getName()
        );

        ci.setPdNo(
                packetItem != null && packetItem.getPdNo() != null
                        ? packetItem.getPdNo()
                        : dispatchedItem.getPdNo()
        );

        ci.setClientName(
                packetItem != null && packetItem.getClientName() != null
                        ? packetItem.getClientName()
                        : dispatchedItem.getClientName()
        );

        ci.setClientAddress(
                packetItem != null && packetItem.getClientAddress() != null
                        ? packetItem.getClientAddress()
                        : dispatchedItem.getClientAddress()
        );

        ci.setDrawingNo(
                packetItem != null && packetItem.getDrawingNo() != null
                        ? packetItem.getDrawingNo()
                        : dispatchedItem.getDrawingNo()
        );

        ci.setDescription(
                packetItem != null && packetItem.getDescription() != null
                        ? packetItem.getDescription()
                        : dispatchedItem.getDescription()
        );

        ci.setRemarks(
                packetItem != null && packetItem.getRemarks() != null
                        ? packetItem.getRemarks()
                        : dispatchedItem.getRemarks()
        );

        ci.setQty(
                dispatchedItem.getQuantity() != null
                        ? String.valueOf(dispatchedItem.getQuantity())
                        : "1"
        );

        return ci;
    }

    private String generateChalaanNumber() {
        return "CH-" + System.currentTimeMillis();
    }

    private String safe(Object v) {
        if (v == null) return "-";
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