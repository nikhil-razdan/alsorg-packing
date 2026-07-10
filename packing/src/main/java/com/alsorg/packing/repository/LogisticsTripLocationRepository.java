package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTripLocation;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LogisticsTripLocationRepository
        extends JpaRepository<LogisticsTripLocation, UUID> {

    List<LogisticsTripLocation>
    findByTripIdOrderByRecordedAtDesc(
            UUID tripId
    );

    @Modifying(
            flushAutomatically = true,
            clearAutomatically = false
    )
    @Query("""
        DELETE FROM LogisticsTripLocation l
        WHERE l.trip.id = :tripId
    """)
    int deleteByTripIdForAdminDeletion(
            @Param("tripId") UUID tripId
    );
}