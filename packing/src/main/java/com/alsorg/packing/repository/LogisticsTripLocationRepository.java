package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTripLocation;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LogisticsTripLocationRepository
        extends JpaRepository<LogisticsTripLocation, UUID> {

    @Query("""
            SELECT l
            FROM LogisticsTripLocation l
            WHERE l.trip.id = :tripId
            ORDER BY l.recordedAt DESC, l.id DESC
            """)
    List<LogisticsTripLocation> findByTripIdOrderByRecordedAtDesc(
            @Param("tripId") UUID tripId);

    /*
     * GPS/location history is a high-growth stream. Slice avoids an expensive
     * COUNT(*) when callers only need incremental history pages.
     */
    @Query("""
            SELECT l
            FROM LogisticsTripLocation l
            WHERE l.trip.id = :tripId
            ORDER BY l.recordedAt DESC, l.id DESC
            """)
    Slice<LogisticsTripLocation> findByTripIdOrderByRecordedAtDesc(
            @Param("tripId") UUID tripId,
            Pageable pageable);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("""
            DELETE FROM LogisticsTripLocation l
            WHERE l.trip.id = :tripId
            """)
    int deleteByTripIdForAdminRollback(@Param("tripId") UUID tripId);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("""
            DELETE FROM LogisticsTripLocation l
            WHERE l.trip.id = :tripId
            """)
    int deleteByTripIdForAdminDeletion(@Param("tripId") UUID tripId);
}
