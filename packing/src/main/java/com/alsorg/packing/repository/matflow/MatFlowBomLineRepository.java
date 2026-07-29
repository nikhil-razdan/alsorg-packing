package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBomLine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowBomLineRepository
                extends JpaRepository<MatFlowBomLine, UUID> {

        List<MatFlowBomLine> findByBom_IdOrderByLineNoAsc(
                        UUID bomId);

        boolean existsByBom_IdAndMaterial_Id(
                        UUID bomId,
                        UUID materialId);

        void deleteByBom_Id(UUID bomId);

        Optional<MatFlowBomLine> findByIdAndBom_Id(
                        UUID id,
                        UUID bomId);
}