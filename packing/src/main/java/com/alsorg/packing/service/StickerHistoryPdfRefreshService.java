package com.alsorg.packing.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

/**
 * Rebuilds the PDF snapshot stored inside StickerHistory from the CURRENT
 * PacketItem values while preserving every history/audit field.
 *
 * This service exists separately from PacketService so Dispatch Admin Edit can
 * refresh sticker PDFs without introducing a PacketService <->
 * DispatchedItemService circular dependency.
 */
@Service
public class StickerHistoryPdfRefreshService {

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    private final StickerHistoryRepository stickerHistoryRepository;
    private final PdfStickerService pdfStickerService;

    public StickerHistoryPdfRefreshService(
            StickerHistoryRepository stickerHistoryRepository,
            PdfStickerService pdfStickerService) {
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.pdfStickerService = pdfStickerService;
    }

    /**
     * Rebuild every stored history PDF for the supplied packet items.
     *
     * Nothing except StickerHistory.pdfData is changed. Sticker number, print
     * iteration, generatedBy, generatedAt and reason remain untouched.
     */
    @Transactional
    public int refreshAllForPacketItems(
            Collection<PacketItem> packetItems) {

        if (packetItems == null || packetItems.isEmpty()) {
            return 0;
        }

        Map<UUID, PacketItem> currentItems = new LinkedHashMap<>();

        for (PacketItem item : packetItems) {
            if (item == null || item.getId() == null) {
                continue;
            }

            currentItems.put(item.getId(), item);
        }

        if (currentItems.isEmpty()) {
            return 0;
        }

        List<StickerHistory> histories = stickerHistoryRepository
                .findAllWithPacketItemsByPacketItemIds(
                        currentItems.keySet());

        if (histories == null || histories.isEmpty()) {
            return 0;
        }

        List<StickerHistory> changed = new ArrayList<>();

        for (StickerHistory history : histories) {
            if (history == null) {
                continue;
            }

            PacketItem historyItem = history.getPacketItem();

            if (historyItem == null || historyItem.getId() == null) {
                continue;
            }

            PacketItem currentItem = currentItems.get(
                    historyItem.getId());

            if (currentItem == null) {
                continue;
            }

            byte[] rebuiltPdf = generateCurrentPdf(
                    currentItem,
                    history);

            if (rebuiltPdf == null || rebuiltPdf.length == 0) {
                continue;
            }

            history.setPdfData(rebuiltPdf);
            changed.add(history);
        }

        if (!changed.isEmpty()) {
            stickerHistoryRepository.saveAll(changed);
        }

        return changed.size();
    }

    /**
     * Rebuild one history PDF from its currently linked PacketItem.
     * Useful as a self-healing download path for records edited before the
     * dispatch-history synchronization fix was deployed.
     */
    @Transactional
    public byte[] refreshHistory(
            StickerHistory history) {

        if (history == null) {
            return null;
        }

        PacketItem item = history.getPacketItem();

        if (item == null || item.getId() == null) {
            return history.getPdfData();
        }

        byte[] rebuiltPdf = generateCurrentPdf(
                item,
                history);

        if (rebuiltPdf != null && rebuiltPdf.length > 0) {
            history.setPdfData(rebuiltPdf);
            stickerHistoryRepository.save(history);
            return rebuiltPdf;
        }

        return history.getPdfData();
    }

    private byte[] generateCurrentPdf(
            PacketItem item,
            StickerHistory history) {

        String stickerNumber = firstNonBlank(
                history == null
                        ? null
                        : history.getStickerNumber(),
                item.getStickerNumber());

        if (stickerNumber == null) {
            return null;
        }

        long iteration = positiveLong(
                history == null
                        ? null
                        : history.getPrintIteration(),
                item.getPrintIteration(),
                1L);

        StickerPdfData pdf = buildStickerPdfData(
                item,
                stickerNumber,
                item.getFloor(),
                true,
                iteration);

        return pdfStickerService.generateSticker(pdf);
    }

    /**
     * Mirrors PacketService's current sticker-data mapping so refreshed history
     * PDFs render exactly like a normal generated sticker.
     */
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

        pdf.setQrPayload(
                "ALSORG|TYPE="
                        + itemType
                        + "|PI="
                        + item.getId()
                        + "|SN="
                        + stickerNumber);

        pdf.setShowCompanyHeader(showCompanyHeader);

        pdf.setItemName(
                safeForPdf(item.getItemName())
                        + " ("
                        + safeForPdf(item.getSku())
                        + ")");

        /*
         * These two fields are the important identity fields for this fix.
         * PdfStickerService uses packetNo for the Packet badge and sku for the
         * CODE / SKU card.
         */
        pdf.setPacketNo(item.getPacketNumber());
        pdf.setSku(item.getSku());

        pdf.setDescription(item.getDescription());
        pdf.setLocation(item.getLocation());

        pdf.setFloor(
                factoryFloor != null && !factoryFloor.isBlank()
                        ? factoryFloor.trim()
                        : item.getFloor());

        pdf.setClientName(item.getClientName());
        pdf.setClientAddress(item.getClientAddress());
        pdf.setPdNo(item.getPdNo());
        pdf.setDrawingNo(item.getDrawingNo());
        pdf.setPrintIteration((int) iteration);
        pdf.setQuantity(1);

        LocalDate packingDate = item.getPackedAt() != null
                ? item.getPackedAt().toLocalDate()
                : LocalDate.now(INDIA_ZONE);

        pdf.setDate(packingDate.toString());

        if (hardwareSticker) {
            pdf.setDimensions(null);
            pdf.setWeight(null);
            pdf.setRemarks(null);
        } else {
            pdf.setDimensions(
                    formatDimensionWithVolume(
                            item.getDimensions()));

            pdf.setWeight(
                    formatWeight(
                            item.getWeight()));

            pdf.setRemarks(item.getRemarks());
        }

        return pdf;
    }

    private PacketItemType effectiveItemType(
            PacketItem item) {

        if (item == null || item.getItemType() == null) {
            return PacketItemType.NORMAL;
        }

        return item.getItemType();
    }

    private String safeForPdf(
            String value) {

        return value == null || value.isBlank()
                ? "-"
                : value.trim();
    }

    private String firstNonBlank(
            String... values) {

        if (values == null) {
            return null;
        }

        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return null;
    }

    private long positiveLong(
            Long first,
            Long second,
            long fallback) {

        if (first != null && first.longValue() > 0L) {
            return first.longValue();
        }

        if (second != null && second.longValue() > 0L) {
            return second.longValue();
        }

        return fallback;
    }

    private String formatDimensionWithVolume(
            String dimensions) {

        if (dimensions == null || dimensions.isBlank()) {
            return dimensions;
        }

        try {
            String[] parts = dimensions.split("x");

            if (parts.length < 3) {
                return dimensions;
            }

            double length = Double.parseDouble(
                    parts[0]
                            .replaceAll("[^0-9.]", "")
                            .trim());

            double breadth = Double.parseDouble(
                    parts[1]
                            .replaceAll("[^0-9.]", "")
                            .trim());

            double height = Double.parseDouble(
                    parts[2]
                            .replaceAll("[^0-9.]", "")
                            .trim());

            double volume = (length * breadth * height)
                    / Math.pow(39.3701, 3);

            return dimensions
                    + " ("
                    + String.format(
                            java.util.Locale.ROOT,
                            "%.3f",
                            volume)
                    + " m³)";

        } catch (Exception ignored) {
            return dimensions;
        }
    }

    private String formatWeight(
            String weight) {

        if (weight == null || weight.trim().isEmpty()) {
            return "-";
        }

        String clean = weight.trim().toLowerCase();

        if (clean.contains("kg")) {
            return weight;
        }

        return weight + " kg";
    }
}
