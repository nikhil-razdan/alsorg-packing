package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomAuditResponse;
import com.alsorg.packing.domain.bomflow.BomFlowAuditLog;
import com.alsorg.packing.repository.bomflow.BomFlowAuditLogRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class BomFlowAuditService {

    private final BomFlowAuditLogRepository auditRepo;

    public BomFlowAuditService(
            BomFlowAuditLogRepository auditRepo) {

        this.auditRepo = auditRepo;
    }

    public void record(
            UUID bomId,
            UUID revisionId,
            UUID itemId,
            String action,
            Object oldValue,
            Object newValue,
            String actor) {

        BomFlowAuditLog log = new BomFlowAuditLog();

        log.bomId = bomId;
        log.revisionId = revisionId;
        log.itemId = itemId;
        log.action = action;

        log.oldValue = oldValue == null
                ? null
                : String.valueOf(oldValue);

        log.newValue = newValue == null
                ? null
                : String.valueOf(newValue);

        log.changedBy = actor == null
                || actor.isBlank()
                        ? "SYSTEM"
                        : actor.trim();

        auditRepo.save(log);
    }

    @Transactional(readOnly = true)
    public List<BomAuditResponse> list(
            UUID bomId) {

        return auditRepo
                .findByBomIdOrderByChangedAtDesc(
                        bomId)
                .stream()
                .map(log -> new BomAuditResponse(
                        log.id,
                        log.bomId,
                        log.revisionId,
                        log.itemId,
                        log.action,
                        log.oldValue,
                        log.newValue,
                        log.changedBy,
                        log.changedAt))
                .toList();
    }
}