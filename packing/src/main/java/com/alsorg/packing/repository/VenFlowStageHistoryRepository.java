package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowStageHistory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VenFlowStageHistoryRepository
        extends JpaRepository<VenFlowStageHistory, UUID> {

    List<VenFlowStageHistory> findByEntryIdOrderByEnteredAtAsc(UUID entryId);

    Optional<VenFlowStageHistory> findFirstByEntryIdAndExitedAtIsNullOrderByEnteredAtDesc(
            UUID entryId);
}