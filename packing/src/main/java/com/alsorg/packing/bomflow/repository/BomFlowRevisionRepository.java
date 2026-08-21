package com.alsorg.packing.bomflow.repository;

import com.alsorg.packing.bomflow.domain.BomFlowRevision;
import com.alsorg.packing.bomflow.domain.BomFlowRevisionStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BomFlowRevisionRepository
        extends JpaRepository<BomFlowRevision, UUID> {

    List<BomFlowRevision> findByProductIdOrderByRevisionNoDesc(
            UUID productId);

    Optional<BomFlowRevision> findTopByProductIdOrderByRevisionNoDesc(
            UUID productId);

    Optional<BomFlowRevision> findTopByProductIdAndStatusInOrderByRevisionNoDesc(
            UUID productId,
            Collection<BomFlowRevisionStatus> statuses);

    long countByProductId(
            UUID productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r
            from BomFlowRevision r
            join fetch r.product
            where r.id = :id
            """)
    Optional<BomFlowRevision> findByIdForUpdate(
            @Param("id") UUID id);

    @Query("""
            select r
            from BomFlowRevision r
            join fetch r.product
            where r.id = :id
            """)
    Optional<BomFlowRevision> findByIdWithProduct(
            @Param("id") UUID id);
}
