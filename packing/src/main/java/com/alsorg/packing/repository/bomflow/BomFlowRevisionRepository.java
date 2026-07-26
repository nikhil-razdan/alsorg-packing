package com.alsorg.packing.repository.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowRevision;
import com.alsorg.packing.domain.bomflow.BomFlowStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomFlowRevisionRepository
        extends JpaRepository<BomFlowRevision, UUID> {

    List<BomFlowRevision>
    findByBomIdOrderByRevisionNoDesc(
            UUID bomId);

    Optional<BomFlowRevision>
    findFirstByBomIdOrderByRevisionNoDesc(
            UUID bomId);

    Optional<BomFlowRevision>
    findByBomIdAndRevisionNo(
            UUID bomId,
            Integer revisionNo);

    Optional<BomFlowRevision>
    findByIdAndBomId(
            UUID id,
            UUID bomId);

    List<BomFlowRevision>
    findByBomIdAndStatusOrderByRevisionNoDesc(
            UUID bomId,
            BomFlowStatus status);

    boolean existsByBomIdAndRevisionNo(
            UUID bomId,
            Integer revisionNo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r
            from BomFlowRevision r
            where r.id = :id
            """)
    Optional<BomFlowRevision> findByIdForUpdate(
            @Param("id")
            UUID id);
}