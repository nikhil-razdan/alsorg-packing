package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowMaterialMovement;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VenFlowMaterialMovementRepository
        extends JpaRepository<VenFlowMaterialMovement, UUID> {

    List<VenFlowMaterialMovement>
    findByEntryIdOrderByCreatedAtDesc(UUID entryId);
}