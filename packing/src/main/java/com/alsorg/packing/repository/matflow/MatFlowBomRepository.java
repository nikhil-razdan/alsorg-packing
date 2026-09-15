package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.BomStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowBomRepository extends JpaRepository<MatFlowBom, UUID> {
    List<MatFlowBom> findAllByOrderByUpdatedAtDesc();
    List<MatFlowBom> findByProductionFile_IdOrderByRevisionNoDesc(UUID productionFileId);
    Optional<MatFlowBom> findFirstByProductionFile_IdAndLatestRevisionTrue(UUID productionFileId);
    Optional<MatFlowBom> findFirstByProductionFile_IdAndStatusOrderByRevisionNoDesc(UUID productionFileId, BomStatus status);
}
