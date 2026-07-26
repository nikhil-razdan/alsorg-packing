package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowStockBlock;
import com.alsorg.packing.domain.matflow.MatFlowStoreDecision;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowStockBlockRepository
        extends JpaRepository<MatFlowStockBlock, UUID> {

    Optional<MatFlowStockBlock>
    findByRequisitionLineIdAndActiveTrue(
            UUID requisitionLineId
    );

    List<MatFlowStockBlock>
    findByRequisitionIdAndActiveTrueOrderByReviewedAtAsc(
            UUID requisitionId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select block
            from MatFlowStockBlock block
            where block.requisitionLineId = :requisitionLineId
              and block.active = true
            """)
    Optional<MatFlowStockBlock>
    findActiveByRequisitionLineIdForUpdate(
            @Param("requisitionLineId")
            UUID requisitionLineId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select block
            from MatFlowStockBlock block
            where block.requisitionId = :requisitionId
              and block.active = true
            order by block.reviewedAt asc
            """)
    List<MatFlowStockBlock>
    findActiveByRequisitionIdForUpdate(
            @Param("requisitionId")
            UUID requisitionId
    );

    @Query("""
            select coalesce(sum(block.requestedQty), 0)
            from MatFlowStockBlock block
            where block.matFlowLineId = :matFlowLineId
              and block.active = true
            """)
    BigDecimal sumActiveReviewedQtyByMatFlowLineId(
            @Param("matFlowLineId")
            UUID matFlowLineId
    );

    @Query("""
            select coalesce(sum(block.blockedQty), 0)
            from MatFlowStockBlock block
            where block.matFlowLineId = :matFlowLineId
              and block.active = true
            """)
    BigDecimal sumActiveBlockedQtyByMatFlowLineId(
            @Param("matFlowLineId")
            UUID matFlowLineId
    );

    @Query("""
            select coalesce(sum(block.shortageQty), 0)
            from MatFlowStockBlock block
            where block.matFlowLineId = :matFlowLineId
              and block.active = true
            """)
    BigDecimal sumActiveShortageQtyByMatFlowLineId(
            @Param("matFlowLineId")
            UUID matFlowLineId
    );

    boolean existsByMatFlowLineIdAndDecisionAndActiveTrue(
            UUID matFlowLineId,
            MatFlowStoreDecision decision
    );
}