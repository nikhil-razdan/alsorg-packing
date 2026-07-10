package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTripItem;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LogisticsTripItemRepository
        extends JpaRepository<LogisticsTripItem, UUID> {

    List<LogisticsTripItem> findByTripId(
            UUID tripId
    );

    List<LogisticsTripItem> findByZohoItemId(
            String zohoItemId
    );

    @Query("""
        SELECT COUNT(l)
        FROM LogisticsTripItem l
        WHERE l.trip.id = :tripId
    """)
    long countByTripId(
            @Param("tripId") UUID tripId
    );

    /* =====================================================
       ADMIN DELETE
       ===================================================== */

    @Query("""
        SELECT DISTINCT l
        FROM LogisticsTripItem l
        WHERE l.packetItemId IN :packetItemIds
           OR l.zohoItemId IN :lookupIds
    """)
    List<LogisticsTripItem> findForAdminDeletion(
            @Param("packetItemIds")
            Collection<UUID> packetItemIds,

            @Param("lookupIds")
            Collection<String> lookupIds
    );

    @Modifying(
            flushAutomatically = true,
            clearAutomatically = false
    )
    @Query("""
        DELETE FROM LogisticsTripItem l
        WHERE l.packetItemId IN :packetItemIds
           OR l.zohoItemId IN :lookupIds
    """)
    int deleteForAdminDeletion(
            @Param("packetItemIds")
            Collection<UUID> packetItemIds,

            @Param("lookupIds")
            Collection<String> lookupIds
    );
}