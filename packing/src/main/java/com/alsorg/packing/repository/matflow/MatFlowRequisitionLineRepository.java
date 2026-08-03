package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;

import java.util.Set;
import jakarta.persistence.LockModeType;

import java.util.Optional;

import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowRequisitionLineRepository
                extends JpaRepository<MatFlowRequisitionLine, UUID> {

        List<MatFlowRequisitionLine> findByRequisition_IdOrderByLineNoAsc(
                        UUID requisitionId);

        List<MatFlowRequisitionLine> findByBomLine_Id(
                        UUID bomLineId);

        @Query("""
                        select line
                        from MatFlowRequisitionLine line
                        where line.shortageQty > 0
                          and line.requisition.status not in :excludedStatuses
                        order by line.requisition.createdAt asc,
                                 line.lineNo asc
                        """)
        List<MatFlowRequisitionLine> findOpenShortages(
                        @Param("excludedStatuses") Set<RequisitionStatus> excludedStatuses);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                        select line
                        from MatFlowRequisitionLine line
                        where line.id = :id
                        """)
        Optional<MatFlowRequisitionLine> lockById(
                        @Param("id") UUID id);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                        select line
                        from MatFlowRequisitionLine line
                        where line.requisition.id = :requisitionId
                        order by line.lineNo asc
                        """)
        List<MatFlowRequisitionLine> lockByRequisitionId(
                        @Param("requisitionId") UUID requisitionId);
}