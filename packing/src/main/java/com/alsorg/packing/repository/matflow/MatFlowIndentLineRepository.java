package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowIndentLine;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowIndentLineRepository
        extends JpaRepository<MatFlowIndentLine, UUID> {

    List<MatFlowIndentLine> findByIndentIdAndActiveTrueOrderBySourceLineNoAsc(
            UUID indentId);

    Optional<MatFlowIndentLine> findByIndentIdAndRequisitionLineIdAndActiveTrue(
            UUID indentId,
            UUID requisitionLineId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowIndentLine line
            where line.id = :lineId
              and line.indentId = :indentId
              and line.active = true
            """)
    Optional<MatFlowIndentLine> findActiveLineForUpdate(
            @Param("indentId") UUID indentId,
            @Param("lineId") UUID lineId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowIndentLine line
            where line.indentId = :indentId
              and line.active = true
            order by line.sourceLineNo asc
            """)
    List<MatFlowIndentLine> findActiveByIndentIdForUpdate(
            @Param("indentId") UUID indentId);

    @Query("""
            select coalesce(sum(line.indentQty), 0)
            from MatFlowIndentLine line
            where line.requisitionLineId = :requisitionLineId
              and line.active = true
            """)
    BigDecimal sumActiveIndentQtyByRequisitionLineId(
            @Param("requisitionLineId") UUID requisitionLineId);

    @Query("""
            select coalesce(sum(line.indentQty), 0)
            from MatFlowIndentLine line
            where line.matFlowLineId = :matFlowLineId
              and line.active = true
            """)
    BigDecimal sumActiveIndentQtyByMatFlowLineId(
            @Param("matFlowLineId") UUID matFlowLineId);
}