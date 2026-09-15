package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProductionFileRepository extends JpaRepository<MatFlowProductionFile, UUID> {
    Optional<MatFlowProductionFile> findByProduct_Id(UUID productId);
    Optional<MatFlowProductionFile> findByProductionFileNoIgnoreCase(String fileNo);
    List<MatFlowProductionFile> findAllByOrderByUpdatedAtDesc();
    List<MatFlowProductionFile> findByStageOrderByUpdatedAtDesc(ProductionFileStage stage);
    long countByStage(ProductionFileStage stage);
    long countByReleaseHealth(com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth health);
}
