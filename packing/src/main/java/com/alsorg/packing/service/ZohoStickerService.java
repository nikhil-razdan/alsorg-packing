package com.alsorg.packing.service;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.sticker.ZohoSticker;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.repository.ZohoStickerRepository;
import com.alsorg.packing.service.pdf.PdfStickerService;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;


@Service
public class ZohoStickerService {

    @Value("${sticker.storage.path}")
    private String stickerStoragePath;
    private final ZohoItemCacheService zohoItemCacheService;
    private final PdfStickerService pdfStickerService;
    private final StickerSequenceService stickerSequenceService;
    private final ZohoStickerRepository zohoStickerRepository;
    private final ZohoInventoryClient zohoInventoryClient;

    public ZohoStickerService(
            ZohoItemCacheService zohoItemCacheService,
            PdfStickerService pdfStickerService,
            StickerSequenceService stickerSequenceService,
            ZohoStickerRepository zohoStickerRepository,
            ZohoInventoryClient zohoInventoryClient
    ) {
        this.zohoItemCacheService = zohoItemCacheService;
        this.pdfStickerService = pdfStickerService;
        this.stickerSequenceService = stickerSequenceService;
        this.zohoStickerRepository = zohoStickerRepository;
        this.zohoInventoryClient = zohoInventoryClient;
    }

    @Transactional
    public byte[] generateStickerForZohoItem(String zohoItemId) throws IOException {

        ZohoItemDTO item = zohoInventoryClient.fetchItemDetails(zohoItemId);


        String stickerNumber = stickerSequenceService.generateNextStickerNumber();

        StickerPdfData pdfData = new StickerPdfData();
        pdfData.setStickerNumber(stickerNumber);
        pdfData.setBarcodeText(stickerNumber);
        pdfData.setItemName(item.getName());
        pdfData.setDescription(item.getDescription());
        pdfData.setLocation(item.getLocation());
        pdfData.setFloor(item.getFloor());
        pdfData.setClientName(item.getClientName());
        pdfData.setClientAddress(item.getClientAddress());
        pdfData.setPdNo(item.getPdNo());
        pdfData.setDrawingNo(item.getDrawingNo());
        pdfData.setRemarks(item.getRemarks());
        pdfData.setQuantity(1);
        pdfData.setDate(
            LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy"))
        );

        byte[] pdfBytes = pdfStickerService.generateSticker(pdfData);

        // record generation (optional but useful)
        ZohoSticker sticker = new ZohoSticker();
        sticker.setZohoItemId(zohoItemId);
        sticker.setStickerNumber(stickerNumber);
        sticker.setGeneratedAt(LocalDateTime.now());
        zohoStickerRepository.save(sticker);

        return pdfBytes;
    }
    
    @Transactional(readOnly = true)
    public byte[] getStickerPdfForZohoItem(String zohoItemId) {

        ZohoSticker sticker = zohoStickerRepository.findById(zohoItemId)
            .orElseThrow(() ->
                new IllegalStateException("Sticker not generated for item: " + zohoItemId)
            );

        Path dir = Paths.get(stickerStoragePath);

        try {
            // Find the latest matching sticker file
            return Files.list(dir)
                .filter(p -> p.getFileName().toString().contains(sticker.getStickerNumber()))
                .max(Comparator.comparingLong(p -> p.toFile().lastModified()))
                .map(p -> {
                    try {
                        return Files.readAllBytes(p);
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                })
                .orElseThrow(() ->
                    new IllegalStateException("Sticker PDF not found on disk")
                );

        } catch (IOException e) {
            throw new RuntimeException("Failed to read sticker PDF", e);
        }
    }

    }

