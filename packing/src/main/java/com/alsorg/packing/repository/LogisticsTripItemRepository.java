package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTripItem;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LogisticsTripItemRepository
        extends JpaRepository<LogisticsTripItem, UUID> {

    @Query("""
            SELECT l
            FROM LogisticsTripItem l
            WHERE l.trip.id = :tripId
            ORDER BY l.id ASC
            """)
    List<LogisticsTripItem> findByTripId(
            @Param("tripId") UUID tripId);

    @Query(value = """
            SELECT l
            FROM LogisticsTripItem l
            WHERE l.trip.id = :tripId
            ORDER BY l.id ASC
            """, countQuery = """
            SELECT COUNT(l)
            FROM LogisticsTripItem l
            WHERE l.trip.id = :tripId
            """)
    Page<LogisticsTripItem> findByTripId(
            @Param("tripId") UUID tripId,
            Pageable pageable);

    List<LogisticsTripItem> findByZohoItemId(String zohoItemId);

    @Query("""
            SELECT COUNT(l)
            FROM LogisticsTripItem l
            WHERE l.trip.id = :tripId
            """)
    long countByTripId(@Param("tripId") UUID tripId);

    @Query("""
            SELECT DISTINCT l
            FROM LogisticsTripItem l
            LEFT JOIN FETCH l.trip
            WHERE l.packetItemId = :packetItemId
               OR l.zohoItemId IN :lookupIds
            """)
    List<LogisticsTripItem> findForAdminRollback(
            @Param("packetItemId") UUID packetItemId,
            @Param("lookupIds") Collection<String> lookupIds);

    @Query("""
            SELECT DISTINCT l
            FROM LogisticsTripItem l
            LEFT JOIN FETCH l.trip
            WHERE l.packetItemId IN :packetItemIds
               OR l.zohoItemId IN :lookupIds
            """)
    List<LogisticsTripItem> findForAdminDeletion(
            @Param("packetItemIds") Collection<UUID> packetItemIds,
            @Param("lookupIds") Collection<String> lookupIds);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("""
            DELETE FROM LogisticsTripItem l
            WHERE l.packetItemId IN :packetItemIds
               OR l.zohoItemId IN :lookupIds
            """)
    int deleteForAdminDeletion(
            @Param("packetItemIds") Collection<UUID> packetItemIds,
            @Param("lookupIds") Collection<String> lookupIds);
}
