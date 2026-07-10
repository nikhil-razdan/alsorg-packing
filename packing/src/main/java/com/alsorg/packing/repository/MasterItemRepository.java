package com.alsorg.packing.repository;

import com.alsorg.packing.domain.item.MasterItem;

import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MasterItemRepository
        extends JpaRepository<MasterItem, UUID> {

    /*
     * =====================================================
     * ADMIN DELETE PREVIEW
     * =====================================================
     */

    @Query("""
                SELECT m
                FROM MasterItem m
                WHERE m.id = :masterItemId
            """)
    Optional<MasterItem> findByIdForAdminDeletionPreview(
            @Param("masterItemId") UUID masterItemId);
            

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
                SELECT m
                FROM MasterItem m
                WHERE m.id = :masterItemId
            """)
    Optional<MasterItem> findByIdForAdminDeletion(
            @Param("masterItemId") UUID masterItemId);

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
            Pageable pageable);

}