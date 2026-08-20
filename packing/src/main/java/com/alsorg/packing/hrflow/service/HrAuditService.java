package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.domain.HrAuditAction;
import com.alsorg.packing.hrflow.domain.HrAuditLog;
import com.alsorg.packing.hrflow.repository.HrAuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class HrAuditService {

    private final HrAuditLogRepository repository;

    public HrAuditService(HrAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(HrAuditAction action, String entityType, String entityId, String actor, String message, String metadataJson) {
        HrAuditLog log = new HrAuditLog();
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setActor(actor == null || actor.isBlank() ? "SYSTEM" : actor);
        log.setMessage(message);
        log.setMetadataJson(metadataJson);
        repository.save(log);
    }

    @Transactional(readOnly = true)
    public List<HrAuditLog> recentFor(String entityType, String entityId) {
        return repository.findTop100ByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
    }
}
