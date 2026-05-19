package com.alsorg.packing.service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    private final AuditLogService auditLogService;



    @Value("${sticker.storage.path}")
    private String stickerPath;

    public ZohoStickerService(
            ZohoStickerRepository stickerRepo,
            ZohoStickerHistoryRepository historyRepo,
            DispatchedItemRepository dispatchedRepo,
            PdfStickerService pdfService,
            ZohoInventoryClient zohoClient,
            StickerSequenceService sequenceService,
            ZohoStickerHistoryRepository stickerHistoryRepo,
            AuditLogService auditLogService
    ) {
        this.stickerRepo = stickerRepo;
        this.historyRepo = historyRepo;
        this.dispatchedRepo = dispatchedRepo;
        this.pdfService = pdfService;
        this.zohoClient = zohoClient;
        this.sequenceService = sequenceService;
        this.stickerHistoryRepo = stickerHistoryRepo;
        this.auditLogService = auditLogService;
    }

    // ===============================
    // STEP 1 + 2.4: GENERATE OR REUSE
    // ===============================
    public byte[] generateStickerForZohoItem(String zohoItemId, String factoryFloor) throws IOException {

    System.out.println("🟢 generateStickerForZohoItem called");
    System.out.println("🟢 Zoho Item ID = " + zohoItemId);

    // 🔢 Print iteration (per item)
    long iteration = historyRepo.countByZohoItemId(zohoItemId) + 1;

    byte[] pdfBytes;
    String stickerNumber;
    String filePath;
    String reason;

    // ===============================
    // ALWAYS GENERATE NEW STICKER
    // ===============================

    ZohoItemDTO item = zohoClient.fetchItemDetails(zohoItemId);
    if (item == null) {
        throw new IllegalStateException("Zoho item not found: " + zohoItemId);
    }

    // 🔢 Global unique sticker number
    stickerNumber = sequenceService.generateNextStickerNumber();

    StickerPdfData pdf = new StickerPdfData();
    pdf.setPrintIteration(iteration);                 // 🔴 iteration number (①②③)
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
    pdf.setDimensions(item.getDimensions());
    pdf.setWeight(item.getWeight());
    pdf.setQuantity(1);
    pdf.setDate(
            LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy"))
    );

    pdfBytes = pdfService.generateSticker(pdf);

    String filename = "STICKER_" + stickerNumber + ".pdf";
    Path path = Paths.get(stickerPath, filename);
    Files.createDirectories(path.getParent());
    Files.write(
    	    path,
    	    pdfBytes,
    	    StandardOpenOption.CREATE,
    	    StandardOpenOption.TRUNCATE_EXISTING
    	);


    filePath = path.toString();
    reason = "GENERATED";

    // ===============================
    // UPSERT LATEST STICKER POINTER
    // ===============================
    ZohoSticker sticker =
            stickerRepo.findById(zohoItemId).orElse(new ZohoSticker());

    sticker.setZohoItemId(zohoItemId);
    sticker.setStickerNumber(stickerNumber);
    sticker.setGeneratedAt(LocalDateTime.now());
    sticker.setFilePath(filePath);

    stickerRepo.save(sticker);

    auditLogService.log(
            zohoItemId,
            "Sticker generated (Iteration " + iteration + ")",
            "SYSTEM",
            "SYSTEM"
    );

    System.out.println("🟢 Sticker generated & saved");

    // ===============================
    // WRITE STICKER HISTORY
    // ===============================
    ZohoStickerHistory history = new ZohoStickerHistory();
    history.setZohoItemId(zohoItemId);
    history.setStickerNumber(stickerNumber);
    history.setFilePath(filePath);
    history.setGeneratedAt(LocalDateTime.now());
    history.setGeneratedBy("SYSTEM");
    history.setGeneratedRole("SYSTEM");
    history.setReason(reason);

    historyRepo.save(history);

    System.out.println("🟢 Sticker history recorded: " + reason);

    // ===============================
    // ENSURE DISPATCHED ITEM EXISTS
    // ===============================
    DispatchedItem di = dispatchedRepo.findById(zohoItemId).orElse(null);

    if (di == null) {
        di = new DispatchedItem();
        di.setZohoItemId(zohoItemId);
        di.setName(item.getName());
        di.setSku(item.getSku());
        di.setClientName(item.getClientName());

        di.setPackedAt(LocalDateTime.now());

        // ✅ NEW FLOW
        di.setStatus(ItemDispatchStatus.ON_FLOOR);

        // ✅ DEFAULT FLOOR LOCATION
        
        di.setFloorLocation(factoryFloor);
        di.setFactoryFloor(factoryFloor); // ✅ factory floor
        di.setMovedToFloorAt(LocalDateTime.now());

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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid history ID");
        }

        ZohoStickerHistory history = stickerHistoryRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Sticker history not found"
                ));

        String filePath = history.getFilePath();

        System.out.println("📂 DB filePath: " + filePath);

        Path path = Paths.get(filePath).normalize();
        path = path.toAbsolutePath().normalize();

        // 🔥 FALLBACK 1: filename only
        if (!Files.exists(path)) {
            String filename = Paths.get(filePath).getFileName().toString();
            path = Paths.get(stickerPath, filename).normalize();
            System.out.println("🔁 FALLBACK PATH 1: " + path);
        }

        // 🔥 FALLBACK 2: try working dir
        if (!Files.exists(path)) {
            path = Paths.get("uploads/stickers")
                    .resolve(Paths.get(filePath).getFileName().toString())
                    .normalize();
            System.out.println("🔁 FALLBACK PATH 2: " + path);
        }

        if (!Files.exists(path)) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Sticker file NOT FOUND at: " + path.toString()
            );
        }

        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to read file"
            );
        }
        
        
    }
}
