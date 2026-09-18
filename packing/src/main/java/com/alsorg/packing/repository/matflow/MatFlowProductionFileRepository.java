package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProductionFileRepository extends JpaRepository<MatFlowProductionFile, UUID> {
    List<MatFlowProductionFile> findAllByOrderByUpdatedAtDesc();
    Optional<MatFlowProductionFile> findByProductionFileNoIgnoreCase(String productionFileNo);

    /** Old Product-level Production File lookup retained for historical migration/read compatibility. */
    Optional<MatFlowProductionFile> findByProduct_Id(UUID productId);

    /** Canonical/current Production File: exactly one row per Project with product_id IS NULL. */
    Optional<MatFlowProductionFile> findFirstByProject_IdAndProductIsNullOrderByCreatedAtAsc(UUID projectId);
    List<MatFlowProductionFile> findByProject_IdOrderByCreatedAtAsc(UUID projectId);
}
