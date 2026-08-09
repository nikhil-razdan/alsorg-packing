package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single audit writer for the complete MatFlow service layer.
 * Audit rows participate in the caller transaction so failed business
 * operations never leave successful-looking audit records behind.
 */
@Service
public class MatFlowAuditService {

        private final MatFlowAuditLogRepository auditRepository;
        private final MatFlowAccessService accessService;
        private final ObjectMapper objectMapper;

        public MatFlowAuditService(
                        MatFlowAuditLogRepository auditRepository,
                        MatFlowAccessService accessService,
                        ObjectMapper objectMapper) {
                this.auditRepository = auditRepository;
                this.accessService = accessService;
                this.objectMapper = objectMapper;
        }

        @Transactional
        public MatFlowAuditLog record(
                        String entityType,
                        UUID entityId,
                        String action,
                        String plantCode,
                        String projectCode,
                        String drawingNo,
                        Object details) {

                String cleanEntityType = requiredUpper(entityType, "Audit entity type");
                if (entityId == null) {
                        throw new IllegalArgumentException("Audit entity ID is required");
                }

                String cleanAction = requiredUpper(action, "Audit action");
                String actor = accessService.actor();

                MatFlowAuditLog audit = new MatFlowAuditLog();
                audit.setEntityType(cleanEntityType);
                audit.setEntityId(entityId);
                audit.setAction(cleanAction);
                audit.setDetailsJson(serialize(details));
                audit.setActor(actor);
                audit.setPlantCode(cleanUpper(plantCode));
                audit.setProjectCode(clean(projectCode));
                audit.setDrawingNo(clean(drawingNo));
                audit.setActionAt(LocalDateTime.now());
                audit.setCreatedBy(actor);
                audit.setUpdatedBy(actor);

                return auditRepository.save(audit);
        }

        public Map<String, Object> details(Object... keyValues) {
                if (keyValues == null || keyValues.length == 0) {
                        return Map.of();
                }
                if (keyValues.length % 2 != 0) {
                        throw new IllegalArgumentException(
                                        "Audit detail arguments must contain key/value pairs");
                }

                Map<String, Object> details = new LinkedHashMap<>();
                for (int index = 0; index < keyValues.length; index += 2) {
                        Object keyValue = keyValues[index];
                        if (keyValue == null) {
                                continue;
                        }
                        String key = keyValue.toString().trim();
                        if (!key.isBlank()) {
                                details.put(key, keyValues[index + 1]);
                        }
                }
                return details;
        }

        private String serialize(Object details) {
                Object value = details == null ? Map.of() : details;
                try {
                        return objectMapper.writeValueAsString(value);
                } catch (JsonProcessingException exception) {
                        return """
                                        {
                                          "serializationError": true,
                                          "detailType": "%s"
                                        }
                                        """.formatted(value.getClass().getName());
                }
        }

        private String requiredUpper(String value, String field) {
                String result = cleanUpper(value);
                if (result == null) {
                        throw new IllegalArgumentException(field + " is required");
                }
                return result;
        }

        private String cleanUpper(String value) {
                String result = clean(value);
                return result == null ? null : result.toUpperCase();
        }

        private String clean(String value) {
                if (value == null) {
                        return null;
                }
                String result = value.trim();
                return result.isBlank() ? null : result;
        }
}
