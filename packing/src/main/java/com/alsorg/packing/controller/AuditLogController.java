package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.audit.AuditLog;
import com.alsorg.packing.repository.AuditLogRepository;

@RestController
@RequestMapping("/api/audit")
public class AuditLogController {

    private final AuditLogRepository auditRepo;

    public AuditLogController(AuditLogRepository auditRepo) {
        this.auditRepo = auditRepo;
    }

    /**
     * Fetch activity / audit logs for a Zoho Item
     */
    @GetMapping("/{zohoItemId}")
    public List<AuditLog> getAuditLogs(
            @PathVariable String zohoItemId
    ) {
        return auditRepo.findByZohoItemIdOrderByPerformedAtDesc(zohoItemId);
    }
}
