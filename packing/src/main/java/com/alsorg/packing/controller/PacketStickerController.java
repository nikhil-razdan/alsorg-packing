package com.alsorg.packing.controller;

import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.service.PacketService;

@RestController
@RequestMapping("/api/packets")
public class PacketStickerController {

    private final PacketService packetService;

    public PacketStickerController(PacketService packetService) {
        this.packetService = packetService;
    }

    @GetMapping("/{packetId}/sticker")
    public ResponseEntity<byte[]> downloadSticker(@PathVariable UUID packetId) {

        byte[] pdfBytes = packetService.getExistingStickerPdf(packetId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=packet-sticker-" + packetId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }
    @GetMapping("/ping")
    public String ping() {
        return "Packet sticker controller is alive";
    }
}
