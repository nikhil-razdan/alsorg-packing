package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.audit.AuditLog;
import com.alsorg.packing.repository.AuditLogRepository;

@RestController
@RequestMapping("/api/audit")
@PreAuthorize("isAuthenticated()")
public class AuditLogController {

    private static final int MAX_ITEM_ID_LENGTH = 300;

    private final AuditLogRepository auditRepo;

    public AuditLogController(
            AuditLogRepository auditRepo) {
        this.auditRepo = auditRepo;
    }

    @GetMapping("/{zohoItemId:.+}")
    public List<AuditLog> getAuditLogs(
            @PathVariable String zohoItemId) {
        String cleanId = zohoItemId == null
                ? ""
                : zohoItemId.trim();

        if (cleanId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Item id is required");
        }

        if (cleanId.length() > MAX_ITEM_ID_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Item id is too long");
        }

        /*
         * Compatibility array response retained. Repository pagination should be
         * added when the AuditLogRepository batch is supplied; do not silently
         * truncate historical audit data here.
         */
        return auditRepo.findByZohoItemIdOrderByPerformedAtDesc(cleanId);
    }
}
