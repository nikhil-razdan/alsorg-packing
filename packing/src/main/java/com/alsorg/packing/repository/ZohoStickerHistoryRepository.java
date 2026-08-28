package com.alsorg.packing.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.sticker.ZohoStickerHistory;

/**
 * ZohoStickerHistory uses a Long identity column. The repository ID type must
 * match the entity ID type so inherited find/delete operations are type-safe.
 */
public interface ZohoStickerHistoryRepository
        extends JpaRepository<ZohoStickerHistory, Long> {

    List<ZohoStickerHistory> findByZohoItemIdOrderByGeneratedAtDesc(
            String zohoItemId);

    Page<ZohoStickerHistory> findByZohoItemIdOrderByGeneratedAtDesc(
            String zohoItemId,
            Pageable pageable);

    long countByZohoItemId(String zohoItemId);
}
