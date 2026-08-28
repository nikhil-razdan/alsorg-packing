package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBomRouteStep;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowBomRouteStepRepository
        extends JpaRepository<MatFlowBomRouteStep, UUID> {

    List<MatFlowBomRouteStep> findByBomLine_IdOrderBySequenceNoAsc(UUID bomLineId);

    List<MatFlowBomRouteStep> findByBomLine_Bom_IdOrderByBomLine_LineNoAscSequenceNoAsc(
            UUID bomId);

    boolean existsByBomLine_IdAndSequenceNo(UUID bomLineId, Integer sequenceNo);

    boolean existsByBomLine_IdAndSequenceNoAndIdNot(
            UUID bomLineId,
            Integer sequenceNo,
            UUID id);
}
