package com.alsorg.packing.repository;

import java.time.LocalDateTime;
import org.springframework.data.repository.query.Param;
import com.alsorg.packing.reporting.dto.DailyUserThroughputResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse;
import com.alsorg.packing.controller.dto.StickerHistoryResponse;
import com.alsorg.packing.domain.sticker.StickerHistory;

public interface StickerHistoryRepository
        extends JpaRepository<StickerHistory, UUID> {

    /* ================= ITEM-WISE STICKER HISTORY ================= */

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
    List<StickerHistoryResponse> findHistoryByItemId(
            @Param("itemId") UUID itemId
    );

    /* ================= GENERATED HISTORY - ALL USERS ================= */

    @Query("""
        SELECT new com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse(
            h.id,
            h.packetItem.id,
            h.stickerNumber,
            h.printIteration,
            h.reason,
            h.generatedAt,
            h.generatedBy,
            h.packetItem.itemName,
            h.packetItem.sku,
            h.packetItem.pdNo,
            h.packetItem.drawingNo,
            h.packetItem.clientName,
            h.packetItem.description,
            h.packetItem.packetNumber,
            h.packetItem.floor,
            h.packetItem.weight,
            h.packetItem.dimensions,
            h.packetItem.remarks
        )
        FROM StickerHistory h
        WHERE h.packetItem IS NOT NULL
        ORDER BY h.generatedAt DESC
    """)
    List<GeneratedPacketHistoryResponse> findGeneratedPacketHistoryAll();

    /* ================= GENERATED HISTORY - SPECIFIC USER ================= */

    @Query("""
        SELECT new com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse(
            h.id,
            h.packetItem.id,
            h.stickerNumber,
            h.printIteration,
            h.reason,
            h.generatedAt,
            h.generatedBy,
            h.packetItem.itemName,
            h.packetItem.sku,
            h.packetItem.pdNo,
            h.packetItem.drawingNo,
            h.packetItem.clientName,
            h.packetItem.description,
            h.packetItem.packetNumber,
            h.packetItem.floor,
            h.packetItem.weight,
            h.packetItem.dimensions,
            h.packetItem.remarks
        )
        FROM StickerHistory h
        WHERE h.packetItem IS NOT NULL
          AND LOWER(h.generatedBy) = LOWER(:generatedBy)
        ORDER BY h.generatedAt DESC
    """)
    List<GeneratedPacketHistoryResponse> findGeneratedPacketHistoryByUser(
            @Param("generatedBy") String generatedBy
    );

    /* ================= USER DROPDOWN ================= */

    @Query("""
        SELECT DISTINCT h.generatedBy
        FROM StickerHistory h
        WHERE h.generatedBy IS NOT NULL
          AND h.generatedBy <> ''
        ORDER BY h.generatedBy ASC
    """)
    List<String> findDistinctGeneratedByUsers();

    @Query("""
    	    SELECT new com.alsorg.packing.reporting.dto.DailyUserThroughputResponse(
    	        h.generatedBy,
    	        COUNT(h)
    	    )
    	    FROM StickerHistory h
    	    WHERE h.generatedAt >= :from
    	      AND h.generatedAt < :to
    	    GROUP BY h.generatedBy
    	    ORDER BY COUNT(h) DESC
    	""")
    	List<DailyUserThroughputResponse> countPackedByUserBetween(
    	        @Param("from") LocalDateTime from,
    	        @Param("to") LocalDateTime to
    	);
    
    /* ================= EXISTING COUNTERS / SCANNER SUPPORT ================= */

    long countByGeneratedAtBetween(
            LocalDateTime start,
            LocalDateTime end
    );

    Optional<StickerHistory> findTopByStickerNumberOrderByGeneratedAtDesc(
            String stickerNumber
    );

    /*
     * Optional but useful if your delete logic deletes sticker history.
     */
    void deleteByPacketItem_Id(UUID packetItemId);
}