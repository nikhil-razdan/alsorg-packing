package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProductionConsumptionLine;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProductionConsumptionLineRepository
        extends JpaRepository<MatFlowProductionConsumptionLine, UUID> {

    List<MatFlowProductionConsumptionLine> findByConsumption_IdOrderByCreatedAtAsc(
            UUID consumptionId);
}
