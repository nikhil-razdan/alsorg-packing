package com.alsorg.packing.repository;

import com.alsorg.packing.domain.logistics.LogisticsTripItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LogisticsTripItemRepository extends JpaRepository<LogisticsTripItem, UUID> {

    List<LogisticsTripItem> findByTripId(UUID tripId);

    List<LogisticsTripItem> findByZohoItemId(String zohoItemId);
}