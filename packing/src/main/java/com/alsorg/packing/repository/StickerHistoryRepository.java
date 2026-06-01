package com.alsorg.packing.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.alsorg.packing.controller.dto.StickerHistoryResponse;
import com.alsorg.packing.domain.sticker.StickerHistory;

public interface StickerHistoryRepository
        extends JpaRepository<StickerHistory, UUID> {

    @Query("""
        SELECT new com.alsorg.packing.controller.dto.StickerHistoryResponse(
            h.id,
            h.stickerNumber,
            h.printIteration,
            h.reason,
            h.generatedAt
        )
        FROM StickerHistory h
        WHERE h.packetItem.id = :itemId
        ORDER BY h.generatedAt DESC
    """)
    List<StickerHistoryResponse>
    findHistoryByItemId(UUID itemId);
    
    Optional<StickerHistory> findTopByStickerNumberOrderByGeneratedAtDesc(String stickerNumber);
}