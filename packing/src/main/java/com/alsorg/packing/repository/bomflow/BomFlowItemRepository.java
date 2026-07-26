package com.alsorg.packing.repository.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowItem;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomFlowItemRepository
        extends JpaRepository<BomFlowItem, UUID> {

    List<BomFlowItem>
    findByRevisionIdAndActiveTrueOrderByLineNoAsc(
            UUID revisionId);

    List<BomFlowItem>
    findByRevisionIdOrderByLineNoAsc(
            UUID revisionId);

    Optional<BomFlowItem>
    findByIdAndRevisionId(
            UUID id,
            UUID revisionId);

    boolean existsByRevisionIdAndLineNo(
            UUID revisionId,
            Integer lineNo);

    boolean existsByRevisionIdAndLineNoAndIdNot(
            UUID revisionId,
            Integer lineNo,
            UUID excludedItemId);

    long countByRevisionIdAndActiveTrue(
            UUID revisionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select i
            from BomFlowItem i
            where i.id = :itemId
              and i.revisionId = :revisionId
            """)
    Optional<BomFlowItem> findByIdAndRevisionIdForUpdate(
            @Param("revisionId")
            UUID revisionId,

            @Param("itemId")
            UUID itemId);
}