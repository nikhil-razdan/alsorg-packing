package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * MatFlow audit repository.
 *
 * Legacy List methods remain for exact existing service compatibility. Paged
 * overloads are additive and are the preferred path for audit/report screens.
 */
public interface MatFlowAuditLogRepository
        extends JpaRepository<MatFlowAuditLog, UUID>,
        JpaSpecificationExecutor<MatFlowAuditLog> {

    List<MatFlowAuditLog> findByEntityIdOrderByActionAtAsc(UUID entityId);

    Page<MatFlowAuditLog> findByEntityIdOrderByActionAtAsc(
            UUID entityId,
            Pageable pageable);

    List<MatFlowAuditLog> findByEntityTypeOrderByActionAtDesc(String entityType);

    Page<MatFlowAuditLog> findByEntityTypeOrderByActionAtDesc(
            String entityType,
            Pageable pageable);

    List<MatFlowAuditLog> findByEntityTypeAndEntityIdOrderByActionAtAsc(
            String entityType,
            UUID entityId);

    Page<MatFlowAuditLog> findByEntityTypeAndEntityIdOrderByActionAtAsc(
            String entityType,
            UUID entityId,
            Pageable pageable);
}
