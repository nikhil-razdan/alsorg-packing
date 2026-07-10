package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTripLocation;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LogisticsTripLocationRepository
        extends JpaRepository<LogisticsTripLocation, UUID> {

    /*
     * =====================================================
     * NORMAL LOGISTICS HISTORY
     * =====================================================
     *
     * Explicit JPQL avoids depending on Spring Data parsing
     * "tripId" as either:
     *
     * 1. a direct property named tripId; or
     * 2. the nested property trip.id.
     */

    @Query("""
        SELECT l
        FROM LogisticsTripLocation l
        WHERE l.trip.id = :tripId
        ORDER BY l.recordedAt DESC
    """)
    List<LogisticsTripLocation> findByTripIdOrderByRecordedAtDesc(
            @Param("tripId")
            UUID tripId
    );

    /*
     * =====================================================
     * ADMIN PACKET LIFECYCLE ROLLBACK
     * =====================================================
     */

    @Modifying(
            flushAutomatically = true,
            clearAutomatically = false
    )
    @Query("""
        DELETE FROM LogisticsTripLocation l
        WHERE l.trip.id = :tripId
    """)
    int deleteByTripIdForAdminRollback(
            @Param("tripId")
            UUID tripId
    );

    /*
     * =====================================================
     * ADMIN PERMANENT DELETION
     * =====================================================
     */

    @Modifying(
            flushAutomatically = true,
            clearAutomatically = false
    )
    @Query("""
        DELETE FROM LogisticsTripLocation l
        WHERE l.trip.id = :tripId
    """)
    int deleteByTripIdForAdminDeletion(
            @Param("tripId")
            UUID tripId
    );
}