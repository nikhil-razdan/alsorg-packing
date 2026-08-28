package com.alsorg.packing.service;

import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.config.TimeZoneConfig;
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
        log.setZohoItemId(clean(zohoItemId));
        log.setAction(clean(action));
        log.setPerformedBy(safe(performedBy, "SYSTEM"));
        log.setRole(safe(role, "SYSTEM"));
        log.setPerformedAt(
                LocalDateTime.now(
                        TimeZoneConfig.APP_ZONE));

        auditRepo.save(log);
    }

    private String clean(
            String value) {

        if (value == null) {
            return null;
        }

        String text = value.trim();

        return text.isBlank()
                ? null
                : text;
    }

    private String safe(
            String value,
            String fallback) {

        String text = clean(value);

        return text == null
                ? fallback
                : text;
    }
}
