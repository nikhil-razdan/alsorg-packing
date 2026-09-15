package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowWorkItem;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowWorkItemRepository extends JpaRepository<MatFlowWorkItem, UUID> {
    List<MatFlowWorkItem> findByProductionFile_IdOrderByDisplayOrderAscCreatedAtAsc(UUID productionFileId);
    List<MatFlowWorkItem> findByProductionFile_IdAndItemTypeOrderByDisplayOrderAscCreatedAtAsc(UUID productionFileId, WorkItemType type);
    Optional<MatFlowWorkItem> findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(UUID productionFileId, WorkItemType type, String itemKey);
    long countByProductionFile_IdAndItemTypeAndStatusIn(UUID productionFileId, WorkItemType type, Collection<WorkItemStatus> statuses);
    List<MatFlowWorkItem> findByAssignedToIgnoreCaseAndStatusInOrderByDueAtAsc(String assignedTo, Collection<WorkItemStatus> statuses);
}
