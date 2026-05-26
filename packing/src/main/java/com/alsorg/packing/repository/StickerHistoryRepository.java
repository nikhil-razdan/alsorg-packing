package com.alsorg.packing.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.sticker.StickerHistory;

public interface StickerHistoryRepository
        extends JpaRepository<StickerHistory, UUID> {

    List<StickerHistory>
    findByPacketItem_IdOrderByGeneratedAtDesc(UUID itemId);
}