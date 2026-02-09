package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.sticker.ZohoStickerHistory;
import com.alsorg.packing.repository.ZohoStickerHistoryRepository;

@RestController
@RequestMapping("/api/stickers")
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
    public List<ZohoStickerHistory> getStickerHistory(
            @PathVariable String zohoItemId
    ) {
        return historyRepo.findByZohoItemIdOrderByGeneratedAtDesc(zohoItemId);
    }
}
