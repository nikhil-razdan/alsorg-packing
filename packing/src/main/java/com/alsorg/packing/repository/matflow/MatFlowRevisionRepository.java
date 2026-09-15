package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.RevisionStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.RevisionType;
import com.alsorg.packing.domain.matflow.MatFlowRevision;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowRevisionRepository extends JpaRepository<MatFlowRevision, UUID> {
    List<MatFlowRevision> findByProductionFile_IdOrderByCreatedAtDesc(UUID productionFileId);
    Optional<MatFlowRevision> findFirstByProductionFile_IdAndRevisionTypeAndRevisionStatusOrderByActivatedAtDesc(UUID productionFileId, RevisionType type, RevisionStatus status);
    boolean existsByProductionFile_IdAndRevisionTypeAndRevisionNoIgnoreCase(UUID productionFileId, RevisionType type, String revisionNo);
}
