package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBom;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowBomRepository extends JpaRepository<MatFlowBom, UUID> {
    List<MatFlowBom> findAllByOrderByUpdatedAtDesc();

    /* Historical single-file helpers retained because old Product-level rows may still exist. */
    Optional<MatFlowBom> findFirstByProductionFile_IdAndLatestRevisionTrue(UUID productionFileId);
    List<MatFlowBom> findByProductionFile_IdOrderByRevisionNoDesc(UUID productionFileId);

    /* Canonical Project Production File + Product-specific BOM helpers. */
    Optional<MatFlowBom> findFirstByProductionFile_IdAndProjectDrawing_IdAndLatestRevisionTrue(
            UUID productionFileId, UUID projectDrawingId);
    List<MatFlowBom> findByProductionFile_IdAndProjectDrawing_IdOrderByRevisionNoDesc(
            UUID productionFileId, UUID projectDrawingId);
    List<MatFlowBom> findByProductionFile_IdAndLatestRevisionTrueOrderByUpdatedAtDesc(UUID productionFileId);
}
