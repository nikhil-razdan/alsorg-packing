package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowQcInspection;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VenFlowQcInspectionRepository
        extends JpaRepository<VenFlowQcInspection, UUID> {

    List<VenFlowQcInspection>
    findByEntryIdOrderByCheckedAtDesc(UUID entryId);

    List<VenFlowQcInspection>
    findByAllocationIdOrderByCheckedAtDesc(UUID allocationId);
}