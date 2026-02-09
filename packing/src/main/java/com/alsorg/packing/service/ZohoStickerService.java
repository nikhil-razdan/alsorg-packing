package com.alsorg.packing.service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.sticker.ZohoSticker;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.ZohoStickerRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Service
@Transactional
public class ZohoStickerService {

    private final ZohoStickerRepository stickerRepo;
    private final DispatchedItemRepository dispatchedRepo;
    private final PdfStickerService pdfService;
    private final ZohoInventoryClient zohoClient;
    private final StickerSequenceService sequenceService;

    @Value("${sticker.storage.path}")
    private String stickerPath;

    public ZohoStickerService(
            ZohoStickerRepository stickerRepo,
            DispatchedItemRepository dispatchedRepo,
            PdfStickerService pdfService,
            ZohoInventoryClient zohoClient,
            StickerSequenceService sequenceService
    ) {
        this.stickerRepo = stickerRepo;
        this.dispatchedRepo = dispatchedRepo;
        this.pdfService = pdfService;
        this.zohoClient = zohoClient;
        this.sequenceService = sequenceService;
    }

    // ===============================
    // STEP 1: GENERATE (ONLY ONCE)
    // ===============================
    public byte[] generateStickerForZohoItem(String zohoItemId) throws IOException {

        System.out.println("🟢 STEP 1: generateStickerForZohoItem called");
        System.out.println("🟢 Zoho Item ID = " + zohoItemId);

        byte[] pdfBytes;

        ZohoSticker existingSticker = stickerRepo.findById(zohoItemId).orElse(null);

        if (existingSticker != null) {
            // ✅ Reuse existing PDF
            System.out.println("🟡 Sticker already exists, reusing PDF");
            pdfBytes = Files.readAllBytes(Paths.get(existingSticker.getFilePath()));
        } else {
            // ✅ Generate new sticker
            ZohoItemDTO item = zohoClient.fetchItemDetails(zohoItemId);
            if (item == null) {
                throw new IllegalStateException("Zoho item not found: " + zohoItemId);
            }

            String stickerNumber = sequenceService.generateNextStickerNumber();

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

            ZohoSticker sticker = new ZohoSticker();
            sticker.setZohoItemId(zohoItemId);
            sticker.setStickerNumber(stickerNumber);
            sticker.setGeneratedAt(LocalDateTime.now());
            sticker.setFilePath(path.toString());

            stickerRepo.save(sticker);

            System.out.println("🟢 Sticker generated & saved");
        }

        // ===============================
        // STEP 7: ENSURE DISPATCHED ITEM
        // ===============================
        System.out.println("🟢 STEP 7: Ensuring dispatched item exists");

        DispatchedItem di = dispatchedRepo.findById(zohoItemId).orElse(null);

        if (di == null) {
            System.out.println("🟢 Creating dispatched item");

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

            System.out.println("🟢 Dispatched item SAVED");
        } else {
            System.out.println("🟡 Dispatched item already exists");
        }

        return pdfBytes;
    }

    // ===============================
    // STEP 2: FETCH ONLY (NO GENERATE)
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
}
