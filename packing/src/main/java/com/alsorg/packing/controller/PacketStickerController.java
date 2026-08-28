package com.alsorg.packing.controller;

import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.service.PacketService;

@RestController
@RequestMapping("/api/packets")
public class PacketStickerController {

    private final PacketService packetService;

    public PacketStickerController(
            PacketService packetService) {
        this.packetService = packetService;
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @GetMapping("/{packetId}/sticker")
    public ResponseEntity<byte[]> downloadSticker(
            @PathVariable UUID packetId) {

        byte[] pdfBytes = packetService.getExistingStickerPdf(packetId);

        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new IllegalStateException("Packet sticker PDF is empty");
        }

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"packet-sticker-"
                                + packetId
                                + ".pdf\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/ping")
    public Map<String, String> ping() {
        return Map.of("status", "ok");
    }
}
