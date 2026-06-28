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
import com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse;
import com.alsorg.packing.security.JwtUtil;
import java.util.Map;

@RestController
@RequestMapping("/api/stickers")
public class StickerHistoryController {

    private final StickerHistoryRepository repository;

    public StickerHistoryController(
            StickerHistoryRepository repository
    ) {
        this.repository = repository;
    }

    @GetMapping("/generated-history")
    public ResponseEntity<List<GeneratedPacketHistoryResponse>> generatedHistory(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(required = false) String generatedBy
    ) {
        String token = extractToken(auth);

        String username = JwtUtil.getUsername(token);
        String role = JwtUtil.getRole(token);

        if ("ADMIN".equalsIgnoreCase(role)) {

            if (generatedBy != null
                    && !generatedBy.isBlank()
                    && !"ALL".equalsIgnoreCase(generatedBy)) {

                return ResponseEntity.ok(
                        repository.findGeneratedPacketHistoryByUser(generatedBy)
                );
            }

            return ResponseEntity.ok(
                    repository.findGeneratedPacketHistoryAll()
            );
        }

        return ResponseEntity.ok(
                repository.findGeneratedPacketHistoryByUser(username)
        );
    }

    @GetMapping("/generated-history/users")
    public ResponseEntity<List<String>> generatedHistoryUsers(
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        String token = extractToken(auth);

        String username = JwtUtil.getUsername(token);
        String role = JwtUtil.getRole(token);

        if ("ADMIN".equalsIgnoreCase(role)) {
            return ResponseEntity.ok(
                    repository.findDistinctGeneratedByUsers()
            );
        }

        return ResponseEntity.ok(List.of(username));
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
    
    private String extractToken(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }

        return auth.replace("Bearer ", "");
    }
}