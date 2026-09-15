package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowAuditLogRepository extends JpaRepository<MatFlowAuditLog, UUID> {
    List<MatFlowAuditLog> findByProductionFileIdOrderByActionAtAsc(UUID productionFileId);
    List<MatFlowAuditLog> findByEntityTypeAndEntityIdOrderByActionAtAsc(String entityType, UUID entityId);
}
