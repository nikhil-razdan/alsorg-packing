package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * MatFlow audit repository.
 *
 * The derived-query methods below support both the existing audit/reporting
 * screens and the append-only Operational Exception & Recovery Register. No
 * new table is introduced: exception events continue to live in mf_audit_logs.
 */
public interface MatFlowAuditLogRepository
        extends JpaRepository<MatFlowAuditLog, UUID>,
        JpaSpecificationExecutor<MatFlowAuditLog> {

    /** Full chronological audit trail for one business entity ID. */
    List<MatFlowAuditLog> findByEntityIdOrderByActionAtAsc(UUID entityId);

    /** Latest-first event stream for one audit entity type. */
    List<MatFlowAuditLog> findByEntityTypeOrderByActionAtDesc(String entityType);

    /** Chronological event stream for one exact entity type + entity ID. */
    List<MatFlowAuditLog> findByEntityTypeAndEntityIdOrderByActionAtAsc(
            String entityType,
            UUID entityId);
}
