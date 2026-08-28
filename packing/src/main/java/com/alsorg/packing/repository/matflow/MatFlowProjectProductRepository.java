package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Backward-compatible repository alias for callers that still use the former
 * Product repository name. The entity remains MatFlowProjectDrawing.
 */
public interface MatFlowProjectProductRepository
        extends JpaRepository<MatFlowProjectDrawing, UUID> {

    List<MatFlowProjectDrawing> findByProject_IdOrderByCreatedAtAsc(UUID projectId);

    Page<MatFlowProjectDrawing> findByProject_IdOrderByCreatedAtAsc(
            UUID projectId,
            Pageable pageable);
}
