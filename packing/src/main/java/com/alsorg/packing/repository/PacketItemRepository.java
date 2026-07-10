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

public interface PacketItemRepository
        extends JpaRepository<PacketItem, UUID> {

    /* =====================================================
       EXISTING METHODS
       Keep these because PacketService already uses them.
       ===================================================== */

    List<PacketItem> findByPacketId(UUID packetId);

    Optional<PacketItem> findBySku(String sku);

    Optional<PacketItem> findByZohoItemId(String zohoItemId);

    Optional<PacketItem> findByStickerNumber(String stickerNumber);

    List<PacketItem> findByPlantCodeIn(
            Collection<String> plantCodes
    );

    List<PacketItem> findByPlantCodeIsNull();

    boolean existsByMasterItemIdAndPacketNumber(
            UUID masterItemId,
            String packetNumber
    );

    long countByMasterItemId(UUID masterItemId);

    /*
     * Required when deciding whether the internal Packet
     * record has become orphaned.
     */
    long countByPacketId(UUID packetId);

    /* =====================================================
       SKU VALIDATION
       ===================================================== */

    @Query("""
        SELECT COUNT(p) > 0
        FROM PacketItem p
        WHERE p.sku IS NOT NULL
          AND LOWER(TRIM(p.sku)) = LOWER(TRIM(:sku))
    """)
    boolean existsSkuAlready(
            @Param("sku") String sku
    );

    @Query("""
        SELECT COUNT(p) > 0
        FROM PacketItem p
        WHERE p.sku IS NOT NULL
          AND LOWER(TRIM(p.sku)) = LOWER(TRIM(:sku))
          AND p.id <> :itemId
    """)
    boolean existsSkuAlreadyForOtherItem(
            @Param("sku") String sku,
            @Param("itemId") UUID itemId
    );

    /* =====================================================
       PLANT VISIBILITY
       ===================================================== */

    @Query("""
        SELECT p
        FROM PacketItem p
        WHERE p.plantCode IN :plantCodes
           OR p.plantCode IS NULL
           OR p.plantCode = ''
    """)
    List<PacketItem> findVisibleByPlantsIncludingLegacy(
            @Param("plantCodes")
            Collection<String> plantCodes
    );

    /* =====================================================
       ADMIN DELETE: LOCKED FETCHES
       ===================================================== */

    /*
     * PESSIMISTIC_WRITE blocks another transaction from editing,
     * dispatching or printing this packet while deletion runs.
     *
     * EntityGraph loads parent Packet and MasterItem inside
     * the same query.
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
            @Param("itemId") UUID itemId
    );

    /*
     * Locks every child packet belonging to a master item.
     */
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
            @Param("masterItemId") UUID masterItemId
    );

    /*
     * Explicit bulk deletion. This is only used by
     * AdminDeletionService.
     */
    @Modifying(
            flushAutomatically = true,
            clearAutomatically = false
    )
    @Query("""
        DELETE FROM PacketItem p
        WHERE p.id IN :itemIds
    """)
    int deleteByIdsForAdminDeletion(
            @Param("itemIds")
            Collection<UUID> itemIds
    );

    /* =====================================================
       ADMIN DELETE CENTER SEARCH
       ===================================================== */

    @Query("""
        SELECT p
        FROM PacketItem p
        LEFT JOIN p.masterItem m
        WHERE LOWER(COALESCE(p.itemName, ''))
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
            Pageable pageable
    );
}