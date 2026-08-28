package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.logistics.LogisticsTripStatus;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LogisticsTripRepository
        extends JpaRepository<LogisticsTrip, UUID> {

    List<LogisticsTrip> findByStatusOrderByTripStartDesc(LogisticsTripStatus status);

    Page<LogisticsTrip> findByStatusOrderByTripStartDesc(
            LogisticsTripStatus status,
            Pageable pageable);

    List<LogisticsTrip> findAllByOrderByTripStartDesc();

    Page<LogisticsTrip> findAllByOrderByTripStartDesc(Pageable pageable);

    List<LogisticsTrip> findAllByOrderByQueuedAtDesc();

    Page<LogisticsTrip> findAllByOrderByQueuedAtDesc(Pageable pageable);

    /*
     * Keep the legacy method name used by current services, but make the nested
     * association path explicit in JPQL rather than relying on property-name
     * splitting of "driverId".
     */
    @Query("""
            select trip
            from LogisticsTrip trip
            where trip.driver.id = :driverId
            order by trip.queuedAt desc, trip.id desc
            """)
    List<LogisticsTrip> findByDriverIdOrderByQueuedAtDesc(
            @Param("driverId") UUID driverId);

    Page<LogisticsTrip> findByDriver_IdOrderByQueuedAtDesc(
            UUID driverId,
            Pageable pageable);
}
