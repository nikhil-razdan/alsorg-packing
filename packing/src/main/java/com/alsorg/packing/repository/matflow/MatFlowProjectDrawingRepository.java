package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProjectDrawingRepository extends JpaRepository<MatFlowProjectDrawing, UUID> {
    List<MatFlowProjectDrawing> findByProject_IdOrderByCreatedAtAsc(UUID projectId);
    Optional<MatFlowProjectDrawing> findByProject_IdAndDrawingNoIgnoreCase(UUID projectId, String drawingNo);
    boolean existsByProject_IdAndDrawingNoIgnoreCase(UUID projectId, String drawingNo);
    boolean existsByProject_IdAndDrawingNoIgnoreCaseAndIdNot(UUID projectId, String drawingNo, UUID id);
}
