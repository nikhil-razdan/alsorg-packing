package com.alsorg.packing.repository;

import com.alsorg.packing.domain.item.PacketItem;

import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.alsorg.packing.domain.common.PacketItemType;

public interface PacketItemRepository
                extends JpaRepository<PacketItem, UUID> {

        /*
         * =====================================================
         * EXISTING METHODS
         * =====================================================
         */

        List<PacketItem> findByPacketId(
                        UUID packetId);

        Optional<PacketItem> findBySku(
                        String sku);

        Optional<PacketItem> findByZohoItemId(
                        String zohoItemId);

        Optional<PacketItem> findByStickerNumber(
                        String stickerNumber);

        List<PacketItem> findByPlantCodeIn(
                        Collection<String> plantCodes);

        List<PacketItem> findByPlantCodeIsNull();

        boolean existsByMasterItemIdAndPacketNumber(
                        UUID masterItemId,
                        String packetNumber);

        long countByMasterItemId(
                        UUID masterItemId);

        long countByPacketId(
                        UUID packetId);

        /*
         * =====================================================
         * SKU VALIDATION
         * =====================================================
         */

        @Query("""
                            SELECT COUNT(p) > 0
                            FROM PacketItem p
                            WHERE p.sku IS NOT NULL
                              AND LOWER(TRIM(p.sku)) = LOWER(TRIM(:sku))
                        """)
        boolean existsSkuAlready(
                        @Param("sku") String sku);

        @Query("""
                            SELECT COUNT(p) > 0
                            FROM PacketItem p
                            WHERE p.sku IS NOT NULL
                              AND LOWER(TRIM(p.sku)) = LOWER(TRIM(:sku))
                              AND p.id <> :itemId
                        """)
        boolean existsSkuAlreadyForOtherItem(
                        @Param("sku") String sku,
                        @Param("itemId") UUID itemId);

        /*
         * =====================================================
         * PLANT VISIBILITY
         * =====================================================
         */

        @Query("""
                            SELECT p
                            FROM PacketItem p
                            WHERE p.plantCode IN :plantCodes
                               OR p.plantCode IS NULL
                               OR p.plantCode = ''
                        """)
        List<PacketItem> findVisibleByPlantsIncludingLegacy(
                        @Param("plantCodes") Collection<String> plantCodes);

        /*
         * =====================================================
         * STICKER GENERATION LOCK
         * =====================================================
         *
         * Prevents:
         * - Two users generating a sticker simultaneously
         * - Sticker generation while Admin Center rollback runs
         * - Rollback while sticker generation is modifying the item
         *
         * This method must only be called inside a normal writable
         * 
         * @Transactional method.
         * =====================================================
         */

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @EntityGraph(attributePaths = {
                        "packet",
                        "masterItem"
        })
        @Query("""
                            SELECT p
                            FROM PacketItem p
                            WHERE p.id = :itemId
                        """)
        Optional<PacketItem> findByIdForStickerGeneration(
                        @Param("itemId") UUID itemId);

        /*
         * =====================================================
         * ADMIN LIFECYCLE ROLLBACK
         * =====================================================
         */

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @EntityGraph(attributePaths = {
                        "packet",
                        "masterItem"
        })
        @Query("""
                            SELECT p
                            FROM PacketItem p
                            WHERE p.id = :itemId
                        """)
        Optional<PacketItem> findByIdForAdminRollback(
                        @Param("itemId") UUID itemId);

        /*
         * Used after READY_PKD -> CREATED rollback.
         *
         * A parent Packet may contain multiple PacketItem rows.
         * Its stickerGenerated flag should be false only when none
         * of its children have an active sticker.
         */
        @Query("""
                            SELECT COUNT(p)
                            FROM PacketItem p
                            WHERE p.packet.id = :packetId
                              AND p.stickerNumber IS NOT NULL
                              AND TRIM(p.stickerNumber) <> ''
                        """)
        long countActiveStickersByPacketId(
                        @Param("packetId") UUID packetId);

        /*
         * =====================================================
         * ADMIN DELETE: LOCKED FETCHES
         * =====================================================
         */

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @EntityGraph(attributePaths = {
                        "packet",
                        "masterItem"
        })
        @Query("""
                            SELECT p
                            FROM PacketItem p
                            WHERE p.id = :itemId
                        """)
        Optional<PacketItem> findByIdForAdminDeletion(
                        @Param("itemId") UUID itemId);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @EntityGraph(attributePaths = {
                        "packet",
                        "masterItem"
        })
        @Query("""
                            SELECT p
                            FROM PacketItem p
                            WHERE p.masterItem.id = :masterItemId
                            ORDER BY p.packetNumber ASC
                        """)
        List<PacketItem> findAllByMasterItemIdForAdminDeletion(
                        @Param("masterItemId") UUID masterItemId);

        @Modifying(flushAutomatically = true, clearAutomatically = false)
        @Query("""
                            DELETE FROM PacketItem p
                            WHERE p.id IN :itemIds
                        """)
        int deleteByIdsForAdminDeletion(
                        @Param("itemIds") Collection<UUID> itemIds);

        /*
         * =====================================================
         * ADMIN CENTER SEARCH
         * =====================================================
         *
         * Description is deliberately included so packets can be
         * found by, and displayed with, their description.
         * =====================================================
         */

        @Query("""
                            SELECT p
                            FROM PacketItem p
                            LEFT JOIN p.masterItem m
                            WHERE LOWER(COALESCE(p.itemName, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(p.description, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(p.pdNo, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(p.drawingNo, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(p.sku, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(p.stickerNumber, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(p.packetNumber, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(p.clientName, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(m.itemName, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))

                               OR LOWER(COALESCE(m.pdNo, ''))
                                      LIKE LOWER(CONCAT('%', :query, '%'))
                        """)
        Page<PacketItem> searchForAdminDeletion(
                        @Param("query") String query,
                        Pageable pageable);

        /*
         * =====================================================
         * ADMIN DELETE PREVIEW - NO DATABASE LOCK
         * =====================================================
         *
         * These methods are safe for @Transactional(readOnly = true).
         * Do not add @Lock to them.
         * =====================================================
         */

        @EntityGraph(attributePaths = {
                        "packet",
                        "masterItem"
        })
        @Query("""
                            SELECT p
                            FROM PacketItem p
                            WHERE p.id = :itemId
                        """)
        Optional<PacketItem> findByIdForAdminDeletionPreview(
                        @Param("itemId") UUID itemId);

        @EntityGraph(attributePaths = {
                        "packet",
                        "masterItem"
        })
        @Query("""
                            SELECT p
                            FROM PacketItem p
                            WHERE p.masterItem.id = :masterItemId
                            ORDER BY p.packetNumber ASC
                        """)
        List<PacketItem> findAllByMasterItemIdForAdminDeletionPreview(
                        @Param("masterItemId") UUID masterItemId);

        @Query("""
                        select distinct p
                        from PacketItem p
                        left join fetch p.hardwareLines
                        left join fetch p.masterItem
                        where p.itemType = :itemType
                        """)
        List<PacketItem> findAllByItemTypeWithHardwareLines(
                        @Param("itemType") PacketItemType itemType);

        @Query("""
                        select distinct p
                        from PacketItem p
                        left join fetch p.hardwareLines
                        left join fetch p.masterItem
                        where p.itemType = :itemType
                          and p.createdByUserId = :userId
                        """)
        List<PacketItem> findOwnedByItemTypeWithHardwareLines(
                        @Param("itemType") PacketItemType itemType,
                        @Param("userId") Long userId);

        @Query("""
                        select distinct p
                        from PacketItem p
                        left join fetch p.hardwareLines
                        left join fetch p.masterItem
                        where p.itemType = :itemType
                          and p.plantCode in :plantCodes
                        """)
        List<PacketItem> findByItemTypeAndPlantCodeInWithHardwareLines(
                        @Param("itemType") PacketItemType itemType,
                        @Param("plantCodes") Collection<String> plantCodes);

        @Query("""
                        select distinct p
                        from PacketItem p
                        left join fetch p.hardwareLines
                        left join fetch p.masterItem
                        where p.masterItem.id = :masterItemId
                        """)
        List<PacketItem> findAllByMasterItemIdWithHardwareLines(
                        @Param("masterItemId") UUID masterItemId);
}