package com.alsorg.packing.repository;

import com.alsorg.packing.domain.common.PacketItemType;
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

public interface PacketItemRepository
        extends JpaRepository<PacketItem, UUID> {

    /*
     * =====================================================
     * BASIC LOOKUPS
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
              AND LOWER(TRIM(p.sku)) =
                  LOWER(TRIM(:sku))
            """)
    boolean existsSkuAlready(
            @Param("sku") String sku);

    @Query("""
            SELECT COUNT(p) > 0
            FROM PacketItem p
            WHERE p.sku IS NOT NULL
              AND LOWER(TRIM(p.sku)) =
                  LOWER(TRIM(:sku))
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
               OR TRIM(p.plantCode) = ''
            """)
    List<PacketItem> findVisibleByPlantsIncludingLegacy(
            @Param("plantCodes") Collection<String> plantCodes);

    /*
     * =====================================================
     * STICKER GENERATION LOCK
     * =====================================================
     *
     * Must only be called inside a writable transaction.
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
     * HARDWARE PACKET UPDATE LOCK
     * =====================================================
     *
     * hardwareLines must not be fetched in this query.
     * They are initialized inside the writable transaction.
     * =====================================================
     */

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE p.id = :itemId
            """)
    Optional<PacketItem> findByIdForHardwarePacketUpdate(
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
     * ADMIN DELETE — LOCKED FETCHES
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

    /*
     * HardwarePacketLine deletion belongs in
     * HardwarePacketLineRepository.
     *
     * Do not put hardware-line bulk deletes here.
     */

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
     */

    @Query("""
            SELECT p
            FROM PacketItem p
            LEFT JOIN p.masterItem m
            WHERE
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        p.description,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        p.pdNo,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        p.drawingNo,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        p.sku,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        p.stickerNumber,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        p.packetNumber,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        p.clientName,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        m.itemName,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )

                OR LOWER(
                    COALESCE(
                        m.pdNo,
                        ''
                    )
                ) LIKE LOWER(
                    CONCAT(
                        '%',
                        :query,
                        '%'
                    )
                )
            """)
    Page<PacketItem> searchForAdminDeletion(
            @Param("query") String query,
            Pageable pageable);

    /*
     * =====================================================
     * ADMIN DELETE PREVIEW — NO DATABASE LOCK
     * =====================================================
     *
     * These queries are used inside read-only transactions.
     * Do not add @Lock.
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

    /*
     * =====================================================
     * HARDWARE INVENTORY READS
     * =====================================================
     */

    @EntityGraph(attributePaths = {
            "masterItem",
            "hardwareLines"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE p.itemType = :itemType
            ORDER BY
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) ASC,
                p.packetNumber ASC
            """)
    List<PacketItem> findAllByItemTypeWithHardwareLines(
            @Param("itemType") PacketItemType itemType);

    @EntityGraph(attributePaths = {
            "masterItem",
            "hardwareLines"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE p.itemType = :itemType
              AND p.createdByUserId = :userId
            ORDER BY
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) ASC,
                p.packetNumber ASC
            """)
    List<PacketItem> findOwnedByItemTypeWithHardwareLines(
            @Param("itemType") PacketItemType itemType,

            @Param("userId") Long userId);

    @EntityGraph(attributePaths = {
            "masterItem",
            "hardwareLines"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE p.itemType = :itemType
              AND p.plantCode IN :plantCodes
            ORDER BY
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) ASC,
                p.packetNumber ASC
            """)
    List<PacketItem> findByItemTypeAndPlantCodeInWithHardwareLines(
            @Param("itemType") PacketItemType itemType,

            @Param("plantCodes") Collection<String> plantCodes);

    @EntityGraph(attributePaths = {
            "masterItem",
            "hardwareLines"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE p.masterItem.id = :masterItemId
            ORDER BY p.packetNumber ASC
            """)
    List<PacketItem> findAllByMasterItemIdWithHardwareLines(
            @Param("masterItemId") UUID masterItemId);

    /*
     * =====================================================
     * NORMAL INVENTORY — OWNER-SCOPED READ
     * =====================================================
     *
     * Modern rows use createdByUserId.
     *
     * Legacy rows use createdBy username only when
     * createdByUserId is null.
     * =====================================================
     */

    @EntityGraph(attributePaths = {
            "masterItem"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE (
                p.itemType IS NULL
                OR p.itemType = :normalType
            )
            AND UPPER(
                TRIM(
                    COALESCE(
                        p.status,
                        ''
                    )
                )
            ) IN :statuses
            AND (
                p.createdByUserId = :userId

                OR (
                    p.createdByUserId IS NULL

                    AND :username IS NOT NULL

                    AND TRIM(:username) <> ''

                    AND LOWER(
                        TRIM(
                            COALESCE(
                                p.createdBy,
                                ''
                            )
                        )
                    ) = LOWER(
                        TRIM(:username)
                    )
                )
            )
            ORDER BY
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) ASC,
                p.packetNumber ASC
            """)
    List<PacketItem> findOwnedNormalInventoryCandidates(
            @Param("normalType") PacketItemType normalType,

            @Param("statuses") Collection<String> statuses,

            @Param("userId") Long userId,

            @Param("username") String username);

    /*
     * =====================================================
     * PACKET NUMBER ALLOCATION
     * =====================================================
     *
     * Used by PacketService to calculate MAX packet number
     * instead of using packet count.
     * =====================================================
     */

    @Query("""
            SELECT p.packetNumber
            FROM PacketItem p
            WHERE p.masterItem.id = :masterItemId
              AND p.packetNumber IS NOT NULL
            """)
    List<String> findPacketNumbersByMasterItemId(
            @Param("masterItemId") UUID masterItemId);

    /*
     * =====================================================
     * LEGACY MASTER OWNERSHIP FALLBACK
     * =====================================================
     */

    @Query("""
            SELECT COUNT(p) > 0
            FROM PacketItem p
            WHERE p.masterItem.id = :masterItemId
              AND (
                  p.createdByUserId = :userId

                  OR (
                      p.createdByUserId IS NULL

                      AND :username IS NOT NULL

                      AND TRIM(:username) <> ''

                      AND LOWER(
                          TRIM(
                              COALESCE(
                                  p.createdBy,
                                  ''
                              )
                          )
                      ) = LOWER(
                          TRIM(:username)
                      )
                  )
              )
            """)
    boolean existsOwnedPacketInMaster(
            @Param("masterItemId") UUID masterItemId,

            @Param("userId") Long userId,

            @Param("username") String username);

    /*
     * =====================================================
     * ADMIN NORMAL INVENTORY
     * =====================================================
     */

    @EntityGraph(attributePaths = {
            "masterItem"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE (
                p.itemType IS NULL
                OR p.itemType = :normalType
            )
            AND UPPER(
                TRIM(
                    COALESCE(
                        p.status,
                        ''
                    )
                )
            ) IN :statuses
            ORDER BY
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) ASC,
                p.packetNumber ASC
            """)
    List<PacketItem> findAdminNormalInventoryCandidates(
            @Param("normalType") PacketItemType normalType,

            @Param("statuses") Collection<String> statuses);

    /*
     * =====================================================
     * LEGACY PLANT-BASED NORMAL INVENTORY
     * =====================================================
     *
     * Retained for backward compatibility.
     *
     * Current owner-scoped PacketService uses
     * findOwnedNormalInventoryCandidates instead.
     * =====================================================
     */

    @EntityGraph(attributePaths = {
            "masterItem"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE (
                p.itemType IS NULL
                OR p.itemType = :normalType
            )
            AND UPPER(
                TRIM(
                    COALESCE(
                        p.status,
                        ''
                    )
                )
            ) = 'CREATED'
            AND (
                p.stickerNumber IS NULL
                OR TRIM(p.stickerNumber) = ''
            )
            AND (
                p.plantCode IN :plantCodes
                OR p.plantCode IS NULL
                OR TRIM(p.plantCode) = ''
            )
            ORDER BY
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) ASC,
                p.packetNumber ASC
            """)
    List<PacketItem> findCreatedNormalInventoryForPlants(
            @Param("normalType") PacketItemType normalType,

            @Param("plantCodes") Collection<String> plantCodes);

    @EntityGraph(attributePaths = {
            "masterItem"
    })
    @Query("""
            SELECT p
            FROM PacketItem p
            WHERE (
                p.itemType IS NULL
                OR p.itemType = :normalType
            )
            AND UPPER(
                TRIM(
                    COALESCE(
                        p.status,
                        ''
                    )
                )
            ) = 'CREATED'
            AND (
                p.stickerNumber IS NULL
                OR TRIM(p.stickerNumber) = ''
            )
            AND (
                p.plantCode IS NULL
                OR TRIM(p.plantCode) = ''
            )
            ORDER BY
                LOWER(
                    COALESCE(
                        p.itemName,
                        ''
                    )
                ) ASC,
                p.packetNumber ASC
            """)
    List<PacketItem> findLegacyCreatedNormalInventory(
            @Param("normalType") PacketItemType normalType);
}