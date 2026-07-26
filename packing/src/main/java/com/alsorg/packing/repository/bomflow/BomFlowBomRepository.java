package com.alsorg.packing.repository.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowBom;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface BomFlowBomRepository
                extends JpaRepository<BomFlowBom, UUID>,
                JpaSpecificationExecutor<BomFlowBom> {

        boolean existsByBomNoIgnoreCase(
                        String bomNo);

        Optional<BomFlowBom> findByBomNoIgnoreCase(
                        String bomNo);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                        select b
                        from BomFlowBom b
                        where b.id = :id
                        """)
        Optional<BomFlowBom> findByIdForUpdate(
                        @Param("id") UUID id);
}