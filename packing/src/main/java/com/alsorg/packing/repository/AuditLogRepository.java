package com.alsorg.packing.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alsorg.packing.domain.audit.AuditLog;

public interface AuditLogRepository
        extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByZohoItemIdOrderByPerformedAtDesc(
            String zohoItemId
    );
}
