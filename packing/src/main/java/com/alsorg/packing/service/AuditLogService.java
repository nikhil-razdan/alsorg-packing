package com.alsorg.packing.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.audit.AuditLog;
import com.alsorg.packing.repository.AuditLogRepository;

@Service
@Transactional
public class AuditLogService {

    private final AuditLogRepository auditRepo;

    public AuditLogService(AuditLogRepository auditRepo) {
        this.auditRepo = auditRepo;
    }

    /**
     * Central audit writer (ONE place)
     */
    public void log(
            String zohoItemId,
            String action,
            String performedBy,
            String role
    ) {
        AuditLog log = new AuditLog();
        log.setZohoItemId(zohoItemId);
        log.setAction(action);
        log.setPerformedBy(performedBy);
        log.setRole(role);
        log.setPerformedAt(LocalDateTime.now());

        auditRepo.save(log);
    }
}
