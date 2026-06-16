package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.logistics.LogisticsTripStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LogisticsTripRepository extends JpaRepository<LogisticsTrip, UUID> {

    List<LogisticsTrip> findByStatusOrderByTripStartDesc(
            LogisticsTripStatus status
    );

    List<LogisticsTrip> findAllByOrderByTripStartDesc();
    List<LogisticsTrip> findAllByOrderByQueuedAtDesc();

List<LogisticsTrip> findByDriverIdOrderByQueuedAtDesc(UUID driverId);
}