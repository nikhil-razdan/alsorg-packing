package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowRequisitionLineRepository
        extends JpaRepository<MatFlowRequisitionLine, UUID> {

    List<MatFlowRequisitionLine> findByRequisition_IdOrderByLineNoAsc(UUID requisitionId);

    List<MatFlowRequisitionLine> findByBomLine_Id(UUID bomLineId);

    @Query("""
            select line
            from MatFlowRequisitionLine line
            where line.shortageQty > 0
              and line.requisition.status not in :excludedStatuses
            order by line.requisition.createdAt asc,
                     line.lineNo asc,
                     line.id asc
            """)
    List<MatFlowRequisitionLine> findOpenShortages(
            @Param("excludedStatuses") Set<RequisitionStatus> excludedStatuses);

    @Query(value = """
            select line
            from MatFlowRequisitionLine line
            where line.shortageQty > 0
              and line.requisition.status not in :excludedStatuses
            order by line.requisition.createdAt asc,
                     line.lineNo asc,
                     line.id asc
            """, countQuery = """
            select count(line)
            from MatFlowRequisitionLine line
            where line.shortageQty > 0
              and line.requisition.status not in :excludedStatuses
            """)
    Page<MatFlowRequisitionLine> findOpenShortages(
            @Param("excludedStatuses") Set<RequisitionStatus> excludedStatuses,
            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowRequisitionLine line
            where line.id = :id
            """)
    Optional<MatFlowRequisitionLine> lockById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select line
            from MatFlowRequisitionLine line
            where line.requisition.id = :requisitionId
            order by line.lineNo asc, line.id asc
            """)
    List<MatFlowRequisitionLine> lockByRequisitionId(
            @Param("requisitionId") UUID requisitionId);
}
