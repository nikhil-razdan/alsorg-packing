package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.DesignTaskStatus;
import com.alsorg.packing.domain.matflow.MatFlowDesignTask;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowDesignTaskRepository extends JpaRepository<MatFlowDesignTask, UUID> {
    List<MatFlowDesignTask> findByProductionFile_IdOrderByReceivedAtAscCreatedAtAsc(UUID productionFileId);
    long countByProductionFile_Id(UUID productionFileId);

    @Query("select distinct t from MatFlowDesignTask t join fetch t.productionFile f left join fetch t.assignees a order by t.receivedAt desc")
    List<MatFlowDesignTask> findAllForQueue();

    @Query("select distinct t from MatFlowDesignTask t join t.assignees a " +
           "where lower(a)=lower(:assignee) and t.status in :statuses order by t.dueAt asc")
    List<MatFlowDesignTask> findAssignedOpen(@Param("assignee") String assignee,
                                             @Param("statuses") Collection<DesignTaskStatus> statuses);
}
