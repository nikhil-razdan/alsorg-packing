package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowAuditResponse;
import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class MatFlowAuditService {

    private final MatFlowAuditLogRepository auditRepo;

    public MatFlowAuditService(
            MatFlowAuditLogRepository auditRepo) {

        this.auditRepo = auditRepo;
    }

    public void record(
            UUID releaseId,
            String entityType,
            UUID entityId,
            String action,
            Object oldValue,
            Object newValue,
            String actor) {

        MatFlowAuditLog log = new MatFlowAuditLog();

        log.releaseId = releaseId;

        log.entityType = entityType;

        log.entityId = entityId;

        log.action = action;

        log.oldValue = oldValue == null
                ? null
                : String.valueOf(
                        oldValue);

        log.newValue = newValue == null
                ? null
                : String.valueOf(
                        newValue);

        log.changedBy = actor == null
                || actor.isBlank()
                        ? "SYSTEM"
                        : actor.trim();

        auditRepo.save(
                log);
    }

    @Transactional(readOnly = true)
    public List<MatFlowAuditResponse> list(
            UUID releaseId) {

        return auditRepo
                .findByReleaseIdOrderByChangedAtDesc(
                        releaseId)
                .stream()
                .map(log -> new MatFlowAuditResponse(
                        log.id,
                        log.releaseId,
                        log.entityType,
                        log.entityId,
                        log.action,
                        log.oldValue,
                        log.newValue,
                        log.changedBy,
                        log.changedAt))
                .toList();
    }
}