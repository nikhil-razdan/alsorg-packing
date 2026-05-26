package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.*;
import com.alsorg.packing.domain.sticker.ZohoStickerHistoryDTO;
import java.util.stream.Collectors;

import com.alsorg.packing.domain.sticker.ZohoStickerHistory;
import com.alsorg.packing.repository.ZohoStickerHistoryRepository;

@RestController
@RequestMapping("/api/zoho-stickers")
public class ZohoStickerHistoryController {

    private final ZohoStickerHistoryRepository historyRepo;

    public ZohoStickerHistoryController(ZohoStickerHistoryRepository historyRepo) {
        this.historyRepo = historyRepo;
    }

    /**
     * STEP 2.6
     * Fetch sticker history for an item
     */   

    @GetMapping("/{zohoItemId}/history")
    public List<ZohoStickerHistoryDTO> getStickerHistory(
            @PathVariable String zohoItemId
    ) {
        System.out.println("📜 Fetching sticker history for: " + zohoItemId);

        List<ZohoStickerHistory> history =
                historyRepo.findByZohoItemIdOrderByGeneratedAtDesc(zohoItemId);

        if (history == null || history.isEmpty()) {
            System.out.println("⚠️ No history found for: " + zohoItemId);
            return List.of();
        }

        return history.stream()
                .map(h -> {
                    System.out.println("🧾 History → ID: " + h.getId()
                            + " | Sticker: " + h.getStickerNumber());

                    return new ZohoStickerHistoryDTO(
                            h.getId().toString(),   // 🔥 CRITICAL FIX
                            h.getStickerNumber(),
                            h.getZohoItemId(),
                            h.getGeneratedAt(),
                            h.getGeneratedBy(),
                            h.getGeneratedRole(),
                            h.getReason()
                    );
                })
                .collect(Collectors.toList());
    }
}
