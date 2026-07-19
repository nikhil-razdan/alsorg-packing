package com.alsorg.packing.repository;

import com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse;
import com.alsorg.packing.controller.dto.StickerHistoryResponse;
import com.alsorg.packing.domain.sticker.StickerHistory;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StickerHistoryRepository
                extends JpaRepository<StickerHistory, UUID> {

        /*
         * =====================================================
         * ITEM-WISE HISTORY
         * =====================================================
         */

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
                        @Param("itemId") UUID itemId);

        /*
         * =====================================================
         * GENERATED HISTORY - ALL
         * =====================================================
         */

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

        /*
         * =====================================================
         * GENERATED HISTORY - USER
         * =====================================================
         */

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
                        @Param("generatedBy") String generatedBy);

        /*
         * =====================================================
         * USER DROPDOWN
         * =====================================================
         */

        @Query("""
                            SELECT DISTINCT h.generatedBy
                            FROM StickerHistory h
                            WHERE h.generatedBy IS NOT NULL
                              AND h.generatedBy <> ''
                            ORDER BY h.generatedBy ASC
                        """)
        List<String> findDistinctGeneratedByUsers();

        /*
         * =====================================================
         * EXISTING SUPPORT
         * =====================================================
         */

        long countByGeneratedAtBetween(
                        LocalDateTime start,
                        LocalDateTime end);

        Optional<StickerHistory> findTopByStickerNumberOrderByGeneratedAtDesc(
                        String stickerNumber);

        void deleteByPacketItem_Id(
                        UUID packetItemId);

        List<StickerHistory> findByPacketItem_IdOrderByGeneratedAtDesc(
                        UUID packetItemId);

        /*
         * Required by Admin Center rollback preview.
         */
        long countByPacketItem_Id(
                        UUID packetItemId);

        /*
         * Required to generate the correct next print iteration after:
         *
         * Sticker iteration 1
         * Admin rollback to CREATED
         * Sticker generated again
         *
         * The new sticker must become iteration 2, not iteration 1.
         */
        @Query("""
                            SELECT COALESCE(MAX(h.printIteration), 0)
                            FROM StickerHistory h
                            WHERE h.packetItem.id = :packetItemId
                        """)
        Long findMaximumPrintIteration(
                        @Param("packetItemId") UUID packetItemId);

        /*
         * =====================================================
         * ADMIN DELETE
         * =====================================================
         */

        long countByPacketItem_IdIn(
                        Collection<UUID> packetItemIds);

        @Modifying(flushAutomatically = true, clearAutomatically = false)
        @Query("""
                            DELETE FROM StickerHistory h
                            WHERE h.packetItem.id IN :packetItemIds
                        """)
        int deleteByPacketItemIdsForAdminDeletion(
                        @Param("packetItemIds") Collection<UUID> packetItemIds);

        @Query("""
                            SELECT h
                            FROM StickerHistory h
                            LEFT JOIN FETCH h.packetItem p
                            WHERE h.id = :historyId
                        """)
        Optional<StickerHistory> findByIdWithPacketItem(
                        @Param("historyId") UUID historyId);
}