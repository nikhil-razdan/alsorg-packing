package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowLine;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowLineRepository
        extends JpaRepository<MatFlowLine, UUID> {

    List<MatFlowLine> findByReleaseIdAndActiveTrueOrderBySourceLineNoAsc(
            UUID releaseId);

    List<MatFlowLine> findByReleaseIdOrderBySourceLineNoAsc(
            UUID releaseId);

    Optional<MatFlowLine> findByIdAndReleaseId(
            UUID id,
            UUID releaseId);

    long countByReleaseIdAndActiveTrue(
            UUID releaseId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowLine line
            where line.id in :ids
              and line.releaseId = :releaseId
              and line.active = true
            order by line.sourceLineNo asc
            """)
    List<MatFlowLine> findActiveByIdsForUpdate(
            @Param("releaseId") UUID releaseId,
            @Param("ids") List<UUID> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowLine line
            where line.id = :lineId
              and line.releaseId = :releaseId
              and line.active = true
            """)
    Optional<MatFlowLine> findActiveByIdForUpdate(
            @Param("releaseId") UUID releaseId,
            @Param("lineId") UUID lineId);
}