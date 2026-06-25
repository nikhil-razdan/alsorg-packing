package com.alsorg.packing.repository;

import com.alsorg.packing.domain.venflow.VenFlowAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VenFlowAuditLogRepository extends JpaRepository<VenFlowAuditLog, UUID> {

    List<VenFlowAuditLog> findByEntryIdOrderByChangedAtDesc(UUID entryId);
}