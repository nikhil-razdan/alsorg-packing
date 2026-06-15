package com.alsorg.packing.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.logistics.LogisticsTripLocation;

public interface LogisticsTripLocationRepository
        extends JpaRepository<LogisticsTripLocation, UUID> {

    List<LogisticsTripLocation> findByTripIdOrderByRecordedAtDesc(UUID tripId);
}