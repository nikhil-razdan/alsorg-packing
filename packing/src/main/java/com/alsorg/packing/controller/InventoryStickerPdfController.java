package com.alsorg.packing.controller;

import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketService;

@RestController
@RequestMapping("/api/inventory/stickers")
public class InventoryStickerPdfController {

    private final PacketService packetService;
    private final CurrentUserService currentUserService;

    public InventoryStickerPdfController(
            PacketService packetService,
            CurrentUserService currentUserService
    ) {
        this.packetService = packetService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/packet-items/{packetItemId}/latest")
    public ResponseEntity<byte[]> latestStickerByPacketItem(
            @PathVariable UUID packetItemId,
            @RequestParam(defaultValue = "false") boolean download,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        Set<String> allowedPlants =
                currentUserService.allowedPlants(user);

        byte[] pdf =
                packetService.getLatestStickerPdfForPacketItem(
                        packetItemId,
                        allowedPlants
                );

        String disposition =
                download ? "attachment" : "inline";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition + "; filename=STICKER_" + packetItemId + ".pdf"
                )
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/history/{historyId}")
    public ResponseEntity<byte[]> stickerByHistoryId(
            @PathVariable UUID historyId,
            @RequestParam(defaultValue = "false") boolean download,
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        Set<String> allowedPlants =
                currentUserService.allowedPlants(user);

        byte[] pdf =
                packetService.getStickerHistoryPdf(
                        historyId,
                        allowedPlants
                );

        String disposition =
                download ? "attachment" : "inline";

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition + "; filename=STICKER_HISTORY_" + historyId + ".pdf"
                )
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}