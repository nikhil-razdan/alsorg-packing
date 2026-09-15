package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatFlowAuditService {
    private final MatFlowAuditLogRepository repository;
    private final MatFlowAccessService accessService;
    private final ObjectMapper objectMapper;

    public MatFlowAuditService(MatFlowAuditLogRepository repository, MatFlowAccessService accessService, ObjectMapper objectMapper) {
        this.repository = repository;
        this.accessService = accessService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void log(String entityType, UUID entityId, String action, MatFlowProductionFile file, Map<String, ?> details) {
        logAsActor(accessService.actor(), entityType, entityId, action, file, details);
    }

    /**
     * System-safe audit entry used by controlled migration/backfill work where no
     * authenticated request exists yet (for example ApplicationReadyEvent).
     */
    @Transactional
    public void logAsActor(String actor, String entityType, UUID entityId, String action,
            MatFlowProductionFile file, Map<String, ?> details) {
        String auditActor = actor == null || actor.isBlank() ? "SYSTEM" : actor.trim();
        MatFlowAuditLog row = new MatFlowAuditLog();
        row.setEntityType(entityType);
        row.setEntityId(entityId);
        row.setAction(action);
        row.setActor(auditActor);
        if (file != null) {
            row.setProductionFileId(file.getId());
            row.setPlantCode(file.getPlantCode());
            row.setProjectCode(file.getProjectCode());
            row.setDrawingNo(file.getDrawingNo());
        }
        row.setDetailsJson(toJson(details));
        row.setCreatedBy(auditActor);
        row.setUpdatedBy(auditActor);
        repository.save(row);
    }

    @Transactional(readOnly = true)
    public List<MatFlowAuditLog> timeline(UUID productionFileId) {
        return repository.findByProductionFileIdOrderByActionAtAsc(productionFileId);
    }

    public Map<String, Object> details(Object... keyValues) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (keyValues == null) return result;
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            if (keyValues[i] != null) result.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return result;
    }

    private String toJson(Map<String, ?> details) {
        if (details == null || details.isEmpty()) return "{}";
        try { return objectMapper.writeValueAsString(details); }
        catch (JsonProcessingException ex) { return "{\"auditSerializationError\":true}"; }
    }
}
