package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MatFlowAuditLogRepository
        extends JpaRepository<MatFlowAuditLog, UUID> {

    List<MatFlowAuditLog> findByReleaseIdOrderByChangedAtDesc(
            UUID releaseId);
}