package com.alsorg.packing.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.repository.UtlPacketRoutingRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

/**
 * Rebuilds normal/hardware sticker snapshots from CURRENT PacketItem values.
 * WR-38 is deliberately different: its stored PDF is an opaque QR identity
 * artifact. Product data is resolved from PackFlow after scan, so the QR bytes
 * remain valid and must not be converted into the normal ALSORG sticker layout.
 */
@Service
public class StickerHistoryPdfRefreshService {

    private static final String WR38_PLANT_CODE = "WR-38";

    private final StickerHistoryRepository stickerHistoryRepository;
    private final PdfStickerService pdfStickerService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private UtlPacketRoutingRepository utlPacketRoutingRepository;

    public StickerHistoryPdfRefreshService(
            StickerHistoryRepository stickerHistoryRepository,
            PdfStickerService pdfStickerService) {
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.pdfStickerService = pdfStickerService;
    }

    @Transactional
    public int refreshAllForPacketItems(Collection<PacketItem> packetItems) {
        if (packetItems == null || packetItems.isEmpty()) return 0;

        Map<UUID, PacketItem> currentItems = new LinkedHashMap<>();
        for (PacketItem item : packetItems) {
            if (item != null && item.getId() != null) currentItems.put(item.getId(), item);
        }
        if (currentItems.isEmpty()) return 0;

        List<StickerHistory> histories = stickerHistoryRepository
                .findAllWithPacketItemsByPacketItemIds(currentItems.keySet());
        if (histories == null || histories.isEmpty()) return 0;

        List<StickerHistory> changed = new ArrayList<>();
        for (StickerHistory history : histories) {
            if (history == null || history.getPacketItem() == null || history.getPacketItem().getId() == null) continue;
            PacketItem currentItem = currentItems.get(history.getPacketItem().getId());
            if (currentItem == null || isWr38(currentItem)) continue;

            byte[] rebuiltPdf = generateCurrentPdf(currentItem, history);
            if (rebuiltPdf == null || rebuiltPdf.length == 0) continue;
            history.setPdfData(rebuiltPdf);
            changed.add(history);
        }

        if (!changed.isEmpty()) stickerHistoryRepository.saveAll(changed);
        return changed.size();
    }

    @Transactional
    public byte[] refreshHistory(StickerHistory history) {
        if (history == null) return null;
        PacketItem item = history.getPacketItem();
        if (item == null || item.getId() == null) return history.getPdfData();

        if (isWr38(item)) {
            /* Keep the QR artifact byte-for-byte; current product data lives in DB. */
            return history.getPdfData();
        }

        byte[] rebuiltPdf = generateCurrentPdf(item, history);
        if (rebuiltPdf != null && rebuiltPdf.length > 0) {
            history.setPdfData(rebuiltPdf);
            stickerHistoryRepository.save(history);
            return rebuiltPdf;
        }
        return history.getPdfData();
    }

    private boolean isUtlPacket(PacketItem item) {
        return item != null
                && item.getId() != null
                && utlPacketRoutingRepository != null
                && utlPacketRoutingRepository.existsById(item.getId());
    }

    private boolean isWr38(PacketItem item) {
        return item != null && item.getPlantCode() != null
                && WR38_PLANT_CODE.equalsIgnoreCase(item.getPlantCode().trim());
    }

    private byte[] generateCurrentPdf(PacketItem item, StickerHistory history) {
        String stickerNumber = firstNonBlank(
                history == null ? null : history.getStickerNumber(),
                item.getStickerNumber());
        if (stickerNumber == null) return null;

        long iteration = positiveLong(
                history == null ? null : history.getPrintIteration(),
                item.getPrintIteration(),
                1L);

        StickerPdfData pdf = buildStickerPdfData(
                item,
                stickerNumber,
                item.getFloor(),
                !isUtlPacket(item),
                iteration);
        return pdfStickerService.generateSticker(pdf);
    }

    private StickerPdfData buildStickerPdfData(
            PacketItem item,
            String stickerNumber,
            String factoryFloor,
            boolean showCompanyHeader,
            long iteration) {

        StickerPdfData pdf = new StickerPdfData();
        PacketItemType itemType = effectiveItemType(item);
        boolean hardwareSticker = itemType == PacketItemType.HARDWARE;

        pdf.setHardwareSticker(hardwareSticker);
        pdf.setStickerNumber(stickerNumber);
        pdf.setBarcodeText(stickerNumber);
        pdf.setPacketItemId(item.getId().toString());
        pdf.setQrPayload("ALSORG|TYPE=" + itemType + "|PI=" + item.getId() + "|SN=" + stickerNumber);
        pdf.setShowCompanyHeader(showCompanyHeader);
        pdf.setItemName(safeForPdf(item.getItemName()) + " (" + safeForPdf(item.getSku()) + ")");
        pdf.setPacketNo(resolveStickerPacketNumber(item.getPacketNumber(), item.getSku()));
        pdf.setSku(item.getSku());
        pdf.setDescription(item.getDescription());
        pdf.setLocation(item.getLocation());
        pdf.setFloor(factoryFloor != null && !factoryFloor.isBlank() ? factoryFloor.trim() : item.getFloor());
        pdf.setClientName(item.getClientName());
        pdf.setClientAddress(item.getClientAddress());
        pdf.setPdNo(item.getPdNo());
        pdf.setDrawingNo(item.getDrawingNo());
        pdf.setPrintIteration(iteration > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) iteration);
        pdf.setQuantity(1);

        LocalDate packingDate = item.getPackedAt() != null
                ? item.getPackedAt().toLocalDate()
                : LocalDate.now(TimeZoneConfig.APP_ZONE);
        pdf.setDate(packingDate.toString());

        if (hardwareSticker) {
            pdf.setDimensions(null);
            pdf.setWeight(null);
            pdf.setRemarks(null);
        } else {
            pdf.setDimensions(formatDimensionWithVolume(item.getDimensions()));
            pdf.setWeight(formatWeight(item.getWeight()));
            pdf.setRemarks(item.getRemarks());
        }
        return pdf;
    }

    private String resolveStickerPacketNumber(String packetNumber, String sku) {
        String fromSku = packetNumberFromSku(sku);
        if (fromSku != null) return fromSku;
        if (packetNumber != null && !packetNumber.trim().isBlank()) return packetNumber.trim();
        return packetNumber;
    }

    private String packetNumberFromSku(String sku) {
        if (sku == null || sku.trim().isBlank()) return null;
        String value = sku.trim();
        String lower = value.toLowerCase(java.util.Locale.ROOT);
        int marker = lower.lastIndexOf("pkt-");
        if (marker < 0) return null;
        String suffix = value.substring(marker + 4);
        String digits = suffix.replaceAll("[^0-9].*$", "").replaceAll("[^0-9]", "");
        if (digits.isBlank()) return null;
        try {
            int number = Integer.parseInt(digits);
            return number > 0 ? "Pkt-" + number : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private PacketItemType effectiveItemType(PacketItem item) {
        return item == null || item.getItemType() == null ? PacketItemType.NORMAL : item.getItemType();
    }

    private String safeForPdf(String value) {
        return value == null || value.isBlank() ? "-" : value.trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            if (value != null && !value.trim().isBlank()) return value.trim();
        }
        return null;
    }

    private long positiveLong(Long first, Long second, long fallback) {
        if (first != null && first > 0L) return first;
        if (second != null && second > 0L) return second;
        return fallback;
    }

    private String formatDimensionWithVolume(String dimensions) {
        if (dimensions == null || dimensions.isBlank()) return dimensions;
        try {
            String[] parts = dimensions.split("x");
            if (parts.length < 3) return dimensions;
            double length = Double.parseDouble(parts[0].replaceAll("[^0-9.]", "").trim());
            double breadth = Double.parseDouble(parts[1].replaceAll("[^0-9.]", "").trim());
            double height = Double.parseDouble(parts[2].replaceAll("[^0-9.]", "").trim());
            double volume = (length * breadth * height) / Math.pow(39.3701, 3);
            return dimensions + " (" + String.format(java.util.Locale.ROOT, "%.3f", volume) + " m³)";
        } catch (Exception ignored) {
            return dimensions;
        }
    }

    private String formatWeight(String weight) {
        if (weight == null || weight.trim().isEmpty()) return "-";
        String clean = weight.trim().toLowerCase();
        if (clean.contains("kg")) return weight;
        return weight + " kg";
    }
}
