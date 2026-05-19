package com.alsorg.packing.controller;


import java.io.IOException;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.service.ZohoStickerService;

@RestController
@RequestMapping("/api/stickers")
public class ZohoStickerController {

    private final ZohoStickerService zohoStickerService;

    public ZohoStickerController(ZohoStickerService zohoStickerService) {
        this.zohoStickerService = zohoStickerService;
    }

    // ✅ ONLY RETURNS PDF (NO GENERATION)
    @GetMapping("/zoho/{zohoItemId}")
    public ResponseEntity<byte[]> getSticker(@PathVariable String zohoItemId) {

        System.out.println("📄 FETCHING PDF FOR ZOHO ITEM: " + zohoItemId);

        byte[] pdf = zohoStickerService.getStickerPdfForZohoItem(zohoItemId);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=STICKER_" + zohoItemId + ".pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
    
    @GetMapping("/history/{historyId}/download")
    public ResponseEntity<byte[]> downloadStickerFromHistory(
            @PathVariable String historyId
    ) {
        System.out.println("📥 Download request for historyId: " + historyId);

        byte[] pdf;

        try {
            pdf = zohoStickerService.downloadStickerFromHistory(historyId);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }

        if (pdf == null || pdf.length == 0) {
            System.out.println("❌ EMPTY PDF for historyId: " + historyId);
            throw new RuntimeException("Sticker PDF not found for historyId: " + historyId);
        }

        System.out.println("✅ Sticker PDF size: " + pdf.length);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=STICKER_" + historyId + ".pdf")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(pdf.length))
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}



