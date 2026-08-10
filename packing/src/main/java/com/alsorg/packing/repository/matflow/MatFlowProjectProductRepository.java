package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProjectProductRepository
        extends JpaRepository<MatFlowProjectDrawing, UUID> {

    List<MatFlowProjectDrawing> findByProject_IdOrderByCreatedAtAsc(UUID projectId);
}
