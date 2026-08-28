package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrAuditLog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HrAuditLogRepository
        extends JpaRepository<HrAuditLog, UUID> {

    List<HrAuditLog> findTop100ByEntityTypeAndEntityIdOrderByCreatedAtDesc(
            String entityType,
            String entityId
    );
}
