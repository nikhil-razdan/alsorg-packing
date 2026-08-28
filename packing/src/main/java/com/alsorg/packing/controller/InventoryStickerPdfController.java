package com.alsorg.packing.controller;

import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketService;

@RestController
@RequestMapping("/api/inventory/stickers")
@PreAuthorize("hasAnyAuthority('ADMIN','PACKING','WAREHOUSE','DISPATCH','LOGISTICS')")
public class InventoryStickerPdfController {

    private final PacketService packetService;
    private final CurrentUserService currentUserService;

    public InventoryStickerPdfController(
            PacketService packetService,
            CurrentUserService currentUserService) {
        this.packetService = packetService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/packet-items/{packetItemId}/latest")
    public ResponseEntity<byte[]> latestStickerByPacketItem(
            @PathVariable UUID packetItemId,
            @RequestParam(defaultValue = "false") boolean download) {

        User user = currentUserService.requireCurrentUser();
        Set<String> allowedPlants = currentUserService.allowedPlants(user);

        byte[] pdf = packetService.getLatestStickerPdfForPacketItem(
                packetItemId,
                allowedPlants);

        return pdfResponse(
                pdf,
                "STICKER_" + packetItemId + ".pdf",
                download);
    }

    @GetMapping("/history/{historyId}")
    public ResponseEntity<byte[]> stickerByHistoryId(
            @PathVariable UUID historyId,
            @RequestParam(defaultValue = "false") boolean download) {

        User user = currentUserService.requireCurrentUser();
        Set<String> allowedPlants = currentUserService.allowedPlants(user);

        byte[] pdf = packetService.getStickerHistoryPdf(
                historyId,
                allowedPlants);

        return pdfResponse(
                pdf,
                "STICKER_HISTORY_" + historyId + ".pdf",
                download);
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String filename,
            boolean download) {

        if (pdf == null || pdf.length == 0) {
            throw new IllegalStateException("Sticker PDF is empty");
        }

        String disposition = download ? "attachment" : "inline";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition + "; filename=\"" + filename + "\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
