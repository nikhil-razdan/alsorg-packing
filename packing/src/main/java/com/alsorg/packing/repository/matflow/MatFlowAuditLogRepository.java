package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface MatFlowAuditLogRepository
        extends JpaRepository<MatFlowAuditLog, UUID>,
        JpaSpecificationExecutor<MatFlowAuditLog> {
}
