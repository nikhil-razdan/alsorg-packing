package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;

import java.util.Set;

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
}