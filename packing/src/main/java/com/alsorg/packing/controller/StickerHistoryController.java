package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse;
import com.alsorg.packing.controller.dto.StickerHistoryResponse;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketService;
import com.alsorg.packing.service.StickerHistoryPdfRefreshService;

@RestController
@RequestMapping("/api/stickers")
public class StickerHistoryController {

    private final StickerHistoryRepository repository;
    private final CurrentUserService currentUserService;
    private final PacketService packetService;
    private final StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService;

    public StickerHistoryController(
            StickerHistoryRepository repository,
            CurrentUserService currentUserService,
            PacketService packetService,
            StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService) {
        this.repository = repository;
        this.currentUserService = currentUserService;
        this.packetService = packetService;
        this.stickerHistoryPdfRefreshService = stickerHistoryPdfRefreshService;
    }

    @GetMapping("/generated-history")
    public ResponseEntity<List<GeneratedPacketHistoryResponse>> generatedHistory(
            @RequestParam(required = false) String generatedBy,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (currentUserService.isAdmin(user)) {
            if (generatedBy != null
                    && !generatedBy.isBlank()
                    && !"ALL".equalsIgnoreCase(generatedBy)) {
                return ResponseEntity.ok(
                        repository.findGeneratedPacketHistoryByUser(generatedBy.trim()));
            }

            return ResponseEntity.ok(repository.findGeneratedPacketHistoryAll());
        }

        return ResponseEntity.ok(
                repository.findGeneratedPacketHistoryByUser(user.getUsername()));
    }

    @GetMapping("/generated-history/users")
    public ResponseEntity<List<String>> generatedHistoryUsers(
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (currentUserService.isAdmin(user)) {
            return ResponseEntity.ok(repository.findDistinctGeneratedByUsers());
        }

        return ResponseEntity.ok(List.of(user.getUsername()));
    }

    @Transactional(readOnly = true)
    @GetMapping("/{itemId}/history")
    public ResponseEntity<List<StickerHistoryResponse>> history(
            @PathVariable UUID itemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService.getCurrentUserFromAuth(auth);
        Set<String> allowedPlants = currentUserService.allowedPlants(user);

        packetService.requireStickerHistoryReadAccess(
                itemId,
                user,
                allowedPlants);

        return ResponseEntity.ok(repository.findHistoryByItemId(itemId));
    }

    @Transactional
    @GetMapping("/history/{historyId}/download-pdf")
    public ResponseEntity<byte[]> download(
            @PathVariable UUID historyId,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService.getCurrentUserFromAuth(auth);
        Set<String> allowedPlants = currentUserService.allowedPlants(user);

        StickerHistory history = repository.findByIdWithPacketItem(historyId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Sticker history not found"));

        PacketItem packetItem = history.getPacketItem();

        if (packetItem != null) {
            packetService.requireStickerHistoryReadAccess(
                    packetItem.getId(),
                    user,
                    allowedPlants);
        } else {
            boolean originalGenerator = history.getGeneratedBy() != null
                    && user.getUsername() != null
                    && history.getGeneratedBy().equalsIgnoreCase(user.getUsername());

            if (!currentUserService.isAdmin(user) && !originalGenerator) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "This legacy sticker record is not linked to a packet item");
            }
        }

        byte[] pdfData = packetItem != null
                ? stickerHistoryPdfRefreshService.refreshHistory(history)
                : history.getPdfData();

        if (pdfData == null || pdfData.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Sticker PDF not found");
        }

        String stickerNumber = history.getStickerNumber() != null
                && !history.getStickerNumber().isBlank()
                        ? history.getStickerNumber().trim()
                        : historyId.toString();

        String safeFileName = stickerNumber
                .replace("\"", "")
                .replace("\r", "")
                .replace("\n", "");

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + safeFileName + ".pdf\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfData);
    }

    @PostMapping("/dispatched/{zohoItemId}/ensure-history")
    public ResponseEntity<Map<String, Object>> ensureHistoryForDispatchedItem(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)
                && !currentUserService.isDispatch(user)
                && !currentUserService.isUtlDispatch(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN, DISPATCH or UTL_DISPATCH can rebuild sticker history");
        }

        StickerHistory history = packetService.ensureStickerHistoryForDispatchedItem(
                zohoItemId,
                user.getUsername(),
                currentUserService.allowedPlants(user));

        UUID packetItemId = history.getPacketItem() != null
                ? history.getPacketItem().getId()
                : null;

        if (packetItemId == null) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Packet item could not be resolved for sticker history");
        }

        return ResponseEntity.ok(
                Map.of(
                        "packetItemId", packetItemId.toString(),
                        "historyId", history.getId().toString(),
                        "stickerNumber", history.getStickerNumber(),
                        "message", "Sticker history is ready"));
    }
}
