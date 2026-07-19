package com.alsorg.packing.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.alsorg.packing.domain.item.MasterItem;

import jakarta.persistence.LockModeType;

public interface MasterItemRepository
        extends JpaRepository<MasterItem, UUID> {

    /*
     * =====================================================
     * ADMIN DELETE PREVIEW
     * =====================================================
     *
     * No lock is used because this is only a preview/read.
     */

    @Query("""
            SELECT m
            FROM MasterItem m
            WHERE m.id = :masterItemId
            """)
    Optional<MasterItem> findByIdForAdminDeletionPreview(
            @Param("masterItemId") UUID masterItemId
    );

    /*
     * =====================================================
     * ADMIN PERMANENT DELETE
     * =====================================================
     */

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT m
            FROM MasterItem m
            WHERE m.id = :masterItemId
            """)
    Optional<MasterItem> findByIdForAdminDeletion(
            @Param("masterItemId") UUID masterItemId
    );

    /*
     * =====================================================
     * HARDWARE MASTER PACKET APPEND
     * =====================================================
     *
     * Used when adding Packet 2, Packet 3, etc. to an
     * existing hardware MasterItem.
     *
     * The lock prevents two simultaneous requests from
     * calculating the same next packet number.
     *
     * This method must be called inside @Transactional.
     */

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT m
            FROM MasterItem m
            WHERE m.id = :masterItemId
            """)
    Optional<MasterItem> findByIdForHardwarePacketAppend(
            @Param("masterItemId") UUID masterItemId
    );

    /*
     * =====================================================
     * ADMIN DELETE SEARCH
     * =====================================================
     */

    @Query("""
            SELECT m
            FROM MasterItem m
            WHERE LOWER(COALESCE(m.itemName, ''))
                      LIKE LOWER(CONCAT('%', :query, '%'))

               OR LOWER(COALESCE(m.pdNo, ''))
                      LIKE LOWER(CONCAT('%', :query, '%'))

               OR LOWER(COALESCE(m.drawingName, ''))
                      LIKE LOWER(CONCAT('%', :query, '%'))

               OR LOWER(COALESCE(m.clientName, ''))
                      LIKE LOWER(CONCAT('%', :query, '%'))

               OR LOWER(COALESCE(m.address, ''))
                      LIKE LOWER(CONCAT('%', :query, '%'))
            """)
    Page<MasterItem> searchForAdminDeletion(
            @Param("query") String query,
            Pageable pageable
    );
}