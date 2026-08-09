package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBom;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowBomRepository extends JpaRepository<MatFlowBom, UUID> {
        List<MatFlowBom> findAllByOrderByUpdatedAtDesc();

        List<MatFlowBom> findByRevisionGroupIdOrderByRevisionNoAsc(UUID revisionGroupId);

        Optional<MatFlowBom> findFirstByRevisionGroupIdOrderByRevisionNoDesc(UUID revisionGroupId);

        Optional<MatFlowBom> findFirstByRevisionGroupIdAndEffectiveTrue(UUID revisionGroupId);

        List<MatFlowBom> findByProjectDrawing_IdOrderByRevisionNoDesc(UUID projectDrawingId);

        boolean existsByProjectDrawing_IdAndEffectiveTrue(UUID projectDrawingId);
}
