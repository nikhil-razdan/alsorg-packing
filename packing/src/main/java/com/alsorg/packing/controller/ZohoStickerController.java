package com.alsorg.packing.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.ZohoStickerService;

@RestController
@RequestMapping("/api/zoho-stickers")
public class ZohoStickerController {

    private static final int MAX_ID_LENGTH = 220;

    private final ZohoStickerService zohoStickerService;
    private final CurrentUserService currentUserService;

    public ZohoStickerController(
            ZohoStickerService zohoStickerService,
            CurrentUserService currentUserService) {
        this.zohoStickerService = zohoStickerService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/zoho/{zohoItemId}")
    public ResponseEntity<byte[]> getSticker(
            @PathVariable String zohoItemId) {
        User user = currentUserService.requireCurrentUser();
        requireLegacyStickerReadAccess(user);

        String cleanId = requireId(zohoItemId, "Zoho item id");
        byte[] pdf = zohoStickerService.getStickerPdfForZohoItem(cleanId);

        return pdfResponse(
                pdf,
                "STICKER_" + safeFilename(cleanId) + ".pdf",
                false);
    }

    @GetMapping("/history/{historyId}/download")
    public ResponseEntity<byte[]> downloadStickerFromHistory(
            @PathVariable String historyId) {
        User user = currentUserService.requireCurrentUser();
        requireLegacyStickerReadAccess(user);

        String cleanId = requireId(historyId, "History id");
        byte[] pdf = zohoStickerService.downloadStickerFromHistory(cleanId);

        return pdfResponse(
                pdf,
                "STICKER_" + safeFilename(cleanId) + ".pdf",
                true);
    }

    private void requireLegacyStickerReadAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "PACKING", "DISPATCH")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to view legacy Zoho stickers");
        }
    }

    private String requireId(String value, String label) {
        if (value == null || value.trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " is required");
        }

        String clean = value.trim();

        if (clean.length() > MAX_ID_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " is too long");
        }

        return clean;
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download) {
        if (pdf == null || pdf.length == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sticker PDF not found");
        }

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        (download ? "attachment" : "inline")
                                + "; filename=\"" + filename + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(pdf.length))
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private String safeFilename(String value) {
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
