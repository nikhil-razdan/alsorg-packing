package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.controller.dto.StickerHistoryResponse;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.repository.StickerHistoryRepository;

@RestController
@RequestMapping("/api/stickers")
public class StickerHistoryController {

    private final StickerHistoryRepository repository;

    public StickerHistoryController(
            StickerHistoryRepository repository
    ) {
        this.repository = repository;
    }

    @GetMapping("/{itemId}/history")
    public List<StickerHistoryResponse> history(
            @PathVariable UUID itemId
    ) {

        return repository.findHistoryByItemId(itemId);
    }

    @Transactional(readOnly = true)
    @GetMapping("/history/{historyId}/download-pdf")
    public ResponseEntity<byte[]> download(
            @PathVariable UUID historyId
    ) {

        StickerHistory history =
                repository.findById(historyId)
                        .orElseThrow();

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename="
                                + history.getStickerNumber()
                                + ".pdf"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(history.getPdfData());
    }
}