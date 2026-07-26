package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowRequisitionLineRepository
        extends JpaRepository<MatFlowRequisitionLine, UUID> {

    List<MatFlowRequisitionLine> findByRequisitionIdAndActiveTrueOrderBySourceLineNoAsc(
            UUID requisitionId);

    boolean existsByRequisitionIdAndMatFlowLineIdAndActiveTrue(
            UUID requisitionId,
            UUID matFlowLineId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowRequisitionLine line
            where line.requisitionId = :requisitionId
              and line.active = true
            order by line.sourceLineNo asc
            """)
    List<MatFlowRequisitionLine> findActiveForUpdate(
            @Param("requisitionId") UUID requisitionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowRequisitionLine line
            where line.id = :lineId
              and line.requisitionId = :requisitionId
              and line.active = true
            """)
    Optional<MatFlowRequisitionLine> findActiveLineForUpdate(
            @Param("requisitionId") UUID requisitionId,
            @Param("lineId") UUID lineId);

    /*
     * Total active requested quantity for a MatFlow line across
     * requisitions that have not been cancelled.
     *
     * We will still recalculate more carefully in the service,
     * but this query is useful for validation and reporting.
     */
    @Query("""
            select coalesce(sum(line.requestedQty), 0)
            from MatFlowRequisitionLine line
            join MatFlowRequisition requisition
              on requisition.id = line.requisitionId
            where line.matFlowLineId = :matFlowLineId
              and line.active = true
              and requisition.status
                  <> com.alsorg.packing.domain.matflow.MatFlowRequisitionStatus.CANCELLED
            """)
    BigDecimal sumActiveRequestedQtyByMatFlowLineId(
            @Param("matFlowLineId") UUID matFlowLineId);

    Optional<MatFlowRequisitionLine> findByRequisitionIdAndMatFlowLineIdAndActiveTrue(
            UUID requisitionId,
            UUID matFlowLineId);

}