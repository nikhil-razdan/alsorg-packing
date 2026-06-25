package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

public interface VenFlowEntryRepository extends JpaRepository<VenFlowEntry, UUID>, JpaSpecificationExecutor<VenFlowEntry> {
}