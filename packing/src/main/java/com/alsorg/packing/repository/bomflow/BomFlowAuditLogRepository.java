package com.alsorg.packing.repository.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowAuditLog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BomFlowAuditLogRepository
        extends JpaRepository<BomFlowAuditLog, UUID> {

    List<BomFlowAuditLog>
    findByBomIdOrderByChangedAtDesc(
            UUID bomId);
}