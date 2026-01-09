package com.alsorg.packing.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.sticker.ZohoSticker;

public interface ZohoStickerRepository
        extends JpaRepository<ZohoSticker, String> {
}
