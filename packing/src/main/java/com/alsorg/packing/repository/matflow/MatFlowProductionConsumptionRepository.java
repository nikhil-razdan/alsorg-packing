package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProductionConsumption;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProductionConsumptionRepository
        extends JpaRepository<MatFlowProductionConsumption, UUID> {

    List<MatFlowProductionConsumption> findAllByOrderByConsumedAtDesc();

    Page<MatFlowProductionConsumption> findAllByOrderByConsumedAtDesc(Pageable pageable);
}
