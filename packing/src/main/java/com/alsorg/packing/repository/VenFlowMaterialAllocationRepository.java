package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowMaterialAllocation;
import com.alsorg.packing.domain.venflow.VenFlowMaterialSource;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VenFlowMaterialAllocationRepository
        extends JpaRepository<VenFlowMaterialAllocation, UUID> {

    List<VenFlowMaterialAllocation>
    findByEntryIdAndActiveTrueOrderByCreatedAtAsc(UUID entryId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a
            from VenFlowMaterialAllocation a
            where a.entryId = :entryId
              and a.active = true
            order by a.createdAt asc
            """)
    List<VenFlowMaterialAllocation>
    findActiveForUpdate(
            @Param("entryId") UUID entryId);

    Optional<VenFlowMaterialAllocation>
    findByIdAndEntryIdAndActiveTrue(
            UUID id,
            UUID entryId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a
            from VenFlowMaterialAllocation a
            where a.id = :allocationId
              and a.entryId = :entryId
              and a.active = true
            """)
    Optional<VenFlowMaterialAllocation>
    findActiveByIdForUpdate(
            @Param("entryId") UUID entryId,
            @Param("allocationId") UUID allocationId);

    Optional<VenFlowMaterialAllocation>
    findFirstByEntryIdAndSourceTypeAndActiveTrue(
            UUID entryId,
            VenFlowMaterialSource sourceType);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a
            from VenFlowMaterialAllocation a
            where a.entryId = :entryId
              and a.sourceType = :sourceType
              and a.active = true
            """)
    Optional<VenFlowMaterialAllocation>
    findActiveBySourceForUpdate(
            @Param("entryId") UUID entryId,
            @Param("sourceType") VenFlowMaterialSource sourceType);

    boolean existsByEntryIdAndActiveTrue(UUID entryId);
}