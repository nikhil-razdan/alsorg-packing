package com.alsorg.packing.service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.sticker.ZohoSticker;
import com.alsorg.packing.domain.sticker.ZohoStickerHistory;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.ZohoStickerRepository;
import com.alsorg.packing.repository.ZohoStickerHistoryRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
@Transactional
public class ZohoStickerService {

    private final ZohoStickerRepository stickerRepo;
    private final ZohoStickerHistoryRepository historyRepo;
    private final DispatchedItemRepository dispatchedRepo;
    private final PdfStickerService pdfService;
    private final ZohoInventoryClient zohoClient;
    private final StickerSequenceService sequenceService;
    private final ZohoStickerHistoryRepository stickerHistoryRepo;


    @Value("${sticker.storage.path}")
    private String stickerPath;

    public ZohoStickerService(
            ZohoStickerRepository stickerRepo,
            ZohoStickerHistoryRepository historyRepo,
            DispatchedItemRepository dispatchedRepo,
            PdfStickerService pdfService,
            ZohoInventoryClient zohoClient,
            StickerSequenceService sequenceService,
            ZohoStickerHistoryRepository stickerHistoryRepo
    ) {
        this.stickerRepo = stickerRepo;
        this.historyRepo = historyRepo;
        this.dispatchedRepo = dispatchedRepo;
        this.pdfService = pdfService;
        this.zohoClient = zohoClient;
        this.sequenceService = sequenceService;
        this.stickerHistoryRepo = stickerHistoryRepo;
    }

    // ===============================
    // STEP 1 + 2.4: GENERATE OR REUSE
    // ===============================
    public byte[] generateStickerForZohoItem(String zohoItemId) throws IOException {

        System.out.println("🟢 generateStickerForZohoItem called");
        System.out.println("🟢 Zoho Item ID = " + zohoItemId);

        byte[] pdfBytes;
        String stickerNumber;
        String filePath;
        String reason;

        ZohoSticker existingSticker = stickerRepo.findById(zohoItemId).orElse(null);

        if (existingSticker != null) {
            // ===============================
            // REUSE EXISTING STICKER
            // ===============================
            System.out.println("🟡 Sticker already exists, reusing PDF");

            pdfBytes = Files.readAllBytes(Paths.get(existingSticker.getFilePath()));
            stickerNumber = existingSticker.getStickerNumber();
            filePath = existingSticker.getFilePath();
            reason = "REUSED";
        } else {
            // ===============================
            // GENERATE NEW STICKER
            // ===============================
            ZohoItemDTO item = zohoClient.fetchItemDetails(zohoItemId);
            if (item == null) {
                throw new IllegalStateException("Zoho item not found: " + zohoItemId);
            }

            stickerNumber = sequenceService.generateNextStickerNumber();

            StickerPdfData pdf = new StickerPdfData();
            pdf.setStickerNumber(stickerNumber);
            pdf.setBarcodeText(stickerNumber);
            pdf.setItemName(item.getName());
            pdf.setDescription(item.getDescription());
            pdf.setLocation(item.getLocation());
            pdf.setFloor(item.getFloor());
            pdf.setClientName(item.getClientName());
            pdf.setClientAddress(item.getClientAddress());
            pdf.setPdNo(item.getPdNo());
            pdf.setDrawingNo(item.getDrawingNo());
            pdf.setRemarks(item.getRemarks());
            pdf.setQuantity(1);
            pdf.setDate(LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy")));

            pdfBytes = pdfService.generateSticker(pdf);

            String filename = "STICKER_" + stickerNumber + ".pdf";
            Path path = Paths.get(stickerPath, filename);
            Files.createDirectories(path.getParent());
            Files.write(path, pdfBytes, StandardOpenOption.CREATE_NEW);

            filePath = path.toString();
            reason = "GENERATED";

            ZohoSticker sticker = new ZohoSticker();
            sticker.setZohoItemId(zohoItemId);
            sticker.setStickerNumber(stickerNumber);
            sticker.setGeneratedAt(LocalDateTime.now());
            sticker.setFilePath(filePath);

            stickerRepo.save(sticker);

            System.out.println("🟢 Sticker generated & saved");
        }

        // ===============================
        // STEP 2.4: WRITE HISTORY
        // ===============================
        ZohoStickerHistory history = new ZohoStickerHistory();
        history.setZohoItemId(zohoItemId);
        history.setStickerNumber(stickerNumber);
        history.setFilePath(filePath);
        history.setGeneratedAt(LocalDateTime.now());
        history.setGeneratedBy("SYSTEM");   // later from session
        history.setGeneratedRole("SYSTEM"); // later from session
        history.setReason(reason);

        historyRepo.save(history);

        System.out.println("🟢 Sticker history recorded: " + reason);

        // ===============================
        // ENSURE DISPATCHED ITEM EXISTS
        // ===============================
        DispatchedItem di = dispatchedRepo.findById(zohoItemId).orElse(null);

        if (di == null) {
            ZohoItemDTO item = zohoClient.fetchItemDetails(zohoItemId);
            if (item == null) {
                throw new IllegalStateException("Zoho item not found: " + zohoItemId);
            }

            di = new DispatchedItem();
            di.setZohoItemId(zohoItemId);
            di.setName(item.getName());
            di.setSku(item.getSku());
            di.setClientName(item.getClientName());
            di.setPackedAt(LocalDateTime.now());
            di.setStatus(ItemDispatchStatus.PACKED);
            di.setStock(1);
            di.setApprovalStatus(ApprovalStatus.NONE);

            dispatchedRepo.save(di);
        }

        return pdfBytes;
    }

    // ===============================
    // STEP 2: FETCH ONLY
    // ===============================
    public byte[] getStickerPdfForZohoItem(String zohoItemId) {

        ZohoSticker sticker = stickerRepo.findById(zohoItemId)
                .orElseThrow(() ->
                        new IllegalStateException("Sticker not generated yet for: " + zohoItemId));

        try {
            return Files.readAllBytes(Paths.get(sticker.getFilePath()));
        } catch (IOException e) {
            throw new RuntimeException("Failed to read sticker PDF", e);
        }
    }
    
 // ===============================
 // STEP 2.7: DOWNLOAD OLD STICKER
 // ===============================
    public byte[] downloadStickerFromHistory(String historyId) {

        UUID id;
        try {
            id = UUID.fromString(historyId);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Invalid history ID: " + historyId);
        }

        ZohoStickerHistory history = stickerHistoryRepo.findById(id)
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Sticker history not found for id: " + historyId
                        )
                );

        Path path = Paths.get(history.getFilePath());

        if (!Files.exists(path)) {
            throw new IllegalStateException(
                    "Sticker file not found on disk: " + history.getFilePath()
            );
        }

        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read sticker file", e);
        }
    }
}
