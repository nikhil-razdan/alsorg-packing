package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTripItem;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LogisticsTripItemRepository
        extends JpaRepository<LogisticsTripItem, UUID> {

    /*
     * =====================================================
     * NORMAL LOGISTICS OPERATIONS
     * =====================================================
     */

    @Query("""
        SELECT l
        FROM LogisticsTripItem l
        WHERE l.trip.id = :tripId
    """)
    List<LogisticsTripItem> findByTripId(
            @Param("tripId")
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
            @Param("tripId")
            UUID tripId
    );

    /*
     * =====================================================
     * ADMIN PACKET LIFECYCLE ROLLBACK
     * =====================================================
     *
     * A packet can be referenced using:
     *
     * 1. LogisticsTripItem.packetItemId
     * 2. PacketItem.id.toString()
     * 3. PacketItem.zohoItemId
     * 4. DispatchedItem.zohoItemId
     *
     * Therefore lookupIds must remain a collection.
     */

    @Query("""
        SELECT DISTINCT l
        FROM LogisticsTripItem l
        LEFT JOIN FETCH l.trip
        WHERE l.packetItemId = :packetItemId
           OR l.zohoItemId IN :lookupIds
    """)
    List<LogisticsTripItem> findForAdminRollback(
            @Param("packetItemId")
            UUID packetItemId,

            @Param("lookupIds")
            Collection<String> lookupIds
    );

    /*
     * =====================================================
     * ADMIN PERMANENT DELETION
     * =====================================================
     */

    @Query("""
        SELECT DISTINCT l
        FROM LogisticsTripItem l
        LEFT JOIN FETCH l.trip
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