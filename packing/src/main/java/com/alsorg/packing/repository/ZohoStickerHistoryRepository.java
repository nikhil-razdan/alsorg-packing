package com.alsorg.packing.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.sticker.ZohoStickerHistory;

public interface ZohoStickerHistoryRepository
        extends JpaRepository<ZohoStickerHistory, UUID> {

    List<ZohoStickerHistory> findByZohoItemIdOrderByGeneratedAtDesc(
            String zohoItemId
    );
}
