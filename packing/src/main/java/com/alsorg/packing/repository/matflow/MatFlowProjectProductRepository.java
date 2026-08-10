package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * vNext Project aggregate repository for Product/Item/Drawing children.
 *
 * Kept separate from the existing MatFlowProjectDrawingRepository so the
 * project hierarchy can be deployed without changing repository contracts
 * that are already used by BOM/Requisition services.
 */
public interface MatFlowProjectProductRepository
        extends JpaRepository<MatFlowProjectDrawing, UUID> {

    List<MatFlowProjectDrawing> findByProject_IdOrderByCreatedAtAsc(UUID projectId);
}
