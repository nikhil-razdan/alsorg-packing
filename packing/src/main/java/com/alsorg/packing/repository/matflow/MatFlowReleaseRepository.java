package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowRelease;
import com.alsorg.packing.domain.matflow.MatFlowReleaseStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowReleaseRepository
        extends JpaRepository<MatFlowRelease, UUID> {

    boolean existsBySourceRevisionId(
            UUID sourceRevisionId);

    Optional<MatFlowRelease> findBySourceRevisionId(
            UUID sourceRevisionId);

    List<MatFlowRelease> findBySourceBomIdOrderBySourceRevisionNoDesc(
            UUID sourceBomId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r
            from MatFlowRelease r
            where r.id = :releaseId
            """)
    Optional<MatFlowRelease> findByIdForUpdate(
            @Param("releaseId") UUID releaseId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r
            from MatFlowRelease r
            where r.sourceBomId = :sourceBomId
              and r.status = :status
            order by r.sourceRevisionNo desc
            """)
    Optional<MatFlowRelease> findFirstBySourceBomIdAndStatusForUpdate(
            @Param("sourceBomId") UUID sourceBomId,

            @Param("status") MatFlowReleaseStatus status);
}