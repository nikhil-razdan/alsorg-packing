package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.sticker.ZohoStickerHistory;
import com.alsorg.packing.domain.sticker.ZohoStickerHistoryDTO;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.ZohoStickerHistoryRepository;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/zoho-stickers")
public class ZohoStickerHistoryController {

    private static final int MAX_ITEM_ID_LENGTH = 220;

    private final ZohoStickerHistoryRepository historyRepo;
    private final CurrentUserService currentUserService;

    public ZohoStickerHistoryController(
            ZohoStickerHistoryRepository historyRepo,
            CurrentUserService currentUserService) {
        this.historyRepo = historyRepo;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/{zohoItemId}/history")
    public List<ZohoStickerHistoryDTO> getStickerHistory(
            @PathVariable String zohoItemId) {

        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.hasAnyRole(user, "ADMIN", "PACKING", "DISPATCH")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to view legacy Zoho sticker history");
        }

        String cleanId = requireItemId(zohoItemId);
        List<ZohoStickerHistory> history = historyRepo
                .findByZohoItemIdOrderByGeneratedAtDesc(cleanId);

        if (history == null || history.isEmpty()) {
            return List.of();
        }

        return history.stream()
                .map(row -> new ZohoStickerHistoryDTO(
                        row.getId().toString(),
                        row.getStickerNumber(),
                        row.getZohoItemId(),
                        row.getGeneratedAt(),
                        row.getGeneratedBy(),
                        row.getGeneratedRole(),
                        row.getReason()))
                .toList();
    }

    private String requireItemId(String value) {
        if (value == null || value.trim().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Zoho item id is required");
        }

        String clean = value.trim();

        if (clean.length() > MAX_ITEM_ID_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Zoho item id is too long");
        }

        return clean;
    }
}
