package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Single audit writer for the complete MatFlow service layer.
 *
 * Audit rows participate in the caller transaction so failed business
 * operations never leave successful-looking audit records behind.
 *
 * The Operational Exception & Recovery Register deliberately reuses the
 * existing immutable mf_audit_logs table. An exception is an append-only event
 * stream whose entityType is WORKFLOW_EXCEPTION and whose entityId is the
 * exception UUID. Every event stores a complete current snapshot in detailsJson.
 * This gives MatFlow a durable "what / why / who / when / recovery" record
 * without introducing a second workflow table or editable blame record.
 */
@Service
public class MatFlowAuditService {

        public static final String WORKFLOW_EXCEPTION_ENTITY = "WORKFLOW_EXCEPTION";

        private static final Set<String> EXCEPTION_STATUSES = Set.of(
                        "OPEN", "CONTAINED", "RECOVERY_IN_PROGRESS", "RESOLVED");
        private static final Set<String> EXCEPTION_SEVERITIES = Set.of(
                        "LOW", "MEDIUM", "HIGH", "CRITICAL");
        private static final Set<String> EXCEPTION_CATEGORIES = Set.of(
                        "WRONG_QUANTITY",
                        "WRONG_SIZE_SPEC",
                        "WRONG_MATERIAL",
                        "WRONG_NAME_CODE",
                        "WRONG_DRAWING_BOM",
                        "WRONG_PROCESSING_ROUTE",
                        "PROCUREMENT_ERROR",
                        "QUALITY_ERROR",
                        "PRODUCTION_ERROR",
                        "DATA_ENTRY_ERROR",
                        "OTHER");

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

        /**
         * Read-only, system-derived accountability trail for linked business records.
         * It deliberately reports who performed which recorded action and never labels
         * a person as the cause of an exception. That distinction is resolved through
         * the root-cause / corrective-action closure fields.
         */
        @Transactional(readOnly = true)
        public List<Map<String, Object>> linkedAccountabilityTrail(Collection<UUID> entityIds) {
                accessService.requireRead();
                if (entityIds == null || entityIds.isEmpty()) {
                        return List.of();
                }
                LinkedHashSet<UUID> ids = new LinkedHashSet<>();
                for (UUID id : entityIds) {
                        if (id != null) {
                                ids.add(id);
                        }
                }
                List<MatFlowAuditLog> rows = new ArrayList<>();
                for (UUID id : ids) {
                        rows.addAll(auditRepository.findByEntityIdOrderByActionAtAsc(id));
                }
                rows.sort(java.util.Comparator.comparing(
                                MatFlowAuditLog::getActionAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));

                List<Map<String, Object>> result = new ArrayList<>();
                for (MatFlowAuditLog row : rows) {
                        if (row == null || WORKFLOW_EXCEPTION_ENTITY.equalsIgnoreCase(row.getEntityType())) {
                                continue;
                        }
                        String plant = cleanUpper(row.getPlantCode());
                        if (plant != null && !accessService.canAccessPlant(plant)) {
                                continue;
                        }
                        Map<String, Object> event = new LinkedHashMap<>();
                        event.put("entityType", row.getEntityType());
                        event.put("entityId", row.getEntityId());
                        event.put("action", row.getAction());
                        event.put("actor", row.getActor());
                        event.put("actionAt", row.getActionAt());
                        event.put("plantCode", row.getPlantCode());
                        event.put("projectCode", row.getProjectCode());
                        event.put("drawingNo", row.getDrawingNo());
                        event.put("details", parseDetails(row.getDetailsJson()));
                        result.add(event);
                }
                int from = Math.max(0, result.size() - 100);
                return new ArrayList<>(result.subList(from, result.size()));
        }

        /* =============================================================
         * OPERATIONAL EXCEPTION & RECOVERY REGISTER
         * ============================================================= */

        @Transactional(readOnly = true)
        public List<Map<String, Object>> listWorkflowExceptions(
                        String plantCode,
                        String status,
                        String severity,
                        String search) {
                accessService.requireRead();

                String plant = cleanUpper(plantCode);
                if (plant != null) {
                        accessService.requirePlantAccess(plant);
                }
                String statusFilter = cleanUpper(status);
                String severityFilter = cleanUpper(severity);
                String term = clean(search);
                term = term == null ? null : term.toLowerCase(Locale.ROOT);

                LinkedHashMap<UUID, Map<String, Object>> latest = new LinkedHashMap<>();
                for (MatFlowAuditLog row : auditRepository
                                .findByEntityTypeOrderByActionAtDesc(WORKFLOW_EXCEPTION_ENTITY)) {
                        if (row == null || row.getEntityId() == null || latest.containsKey(row.getEntityId())) {
                                continue;
                        }
                        Map<String, Object> snapshot = parseDetails(row.getDetailsJson());
                        snapshot.put("id", row.getEntityId());
                        snapshot.put("latestAction", row.getAction());
                        snapshot.put("updatedBy", row.getActor());
                        snapshot.put("updatedAt", row.getActionAt());
                        snapshot.putIfAbsent("plantCode", row.getPlantCode());
                        snapshot.putIfAbsent("projectCode", row.getProjectCode());
                        snapshot.putIfAbsent("drawingNo", row.getDrawingNo());
                        latest.put(row.getEntityId(), snapshot);
                }

                List<Map<String, Object>> result = new ArrayList<>();
                for (Map<String, Object> snapshot : latest.values()) {
                        String recordPlant = cleanUpper(asString(snapshot.get("plantCode")));
                        if (recordPlant != null && !accessService.canAccessPlant(recordPlant)) {
                                continue;
                        }
                        if (plant != null && !plant.equals(recordPlant)) {
                                continue;
                        }
                        if (statusFilter != null && !statusFilter.equals(cleanUpper(asString(snapshot.get("status"))))) {
                                continue;
                        }
                        if (severityFilter != null
                                        && !severityFilter.equals(cleanUpper(asString(snapshot.get("severity"))))) {
                                continue;
                        }
                        if (term != null && !exceptionSearchText(snapshot).contains(term)) {
                                continue;
                        }
                        result.add(snapshot);
                }
                return result;
        }

        @Transactional(readOnly = true)
        public Map<String, Object> getWorkflowException(UUID exceptionId) {
                accessService.requireRead();
                return exceptionWithHistory(exceptionId, true);
        }

        @Transactional
        public Map<String, Object> openWorkflowException(Map<String, Object> request) {
                accessService.requireRead();
                Map<String, Object> input = copy(request);

                String whatHappened = requiredText(input.get("whatHappened"), "What happened");
                String severity = normalizeChoice(input.get("severity"), "MEDIUM", EXCEPTION_SEVERITIES, "Severity");
                String category = normalizeChoice(input.get("category"), "OTHER", EXCEPTION_CATEGORIES, "Category");
                boolean workflowHold = asBoolean(input.get("workflowHold"), true);

                UUID requisitionId = asUuid(input.get("requisitionId"));
                UUID bomId = asUuid(input.get("bomId"));
                List<String> affectedRequisitionIds = uuidStrings(input.get("affectedRequisitionIds"));
                if (workflowHold && requisitionId == null && bomId == null && affectedRequisitionIds.isEmpty()) {
                        throw badRequest(
                                        "A workflow hold must be linked to a BOM or Material Requisition. Use a non-blocking exception for general observations.");
                }

                UUID exceptionId = UUID.randomUUID();
                String actor = accessService.actor();
                LocalDateTime now = LocalDateTime.now();

                Map<String, Object> snapshot = new LinkedHashMap<>();
                snapshot.putAll(input);
                snapshot.put("id", exceptionId.toString());
                snapshot.put("exceptionNumber", exceptionNumber(exceptionId));
                snapshot.put("status", "OPEN");
                snapshot.put("severity", severity);
                snapshot.put("category", category);
                snapshot.put("workflowHold", workflowHold);
                snapshot.put("whatHappened", whatHappened);
                snapshot.put("detectedBy", actor);
                snapshot.put("createdBy", actor);
                snapshot.put("createdAt", now.toString());
                snapshot.put("updatedBy", actor);
                snapshot.put("updatedAt", now.toString());
                snapshot.put("requisitionId", requisitionId == null ? null : requisitionId.toString());
                snapshot.put("bomId", bomId == null ? null : bomId.toString());
                snapshot.put("affectedRequisitionIds", affectedRequisitionIds);
                snapshot.put("eventNote", clean(asString(input.get("eventNote"))));

                validateExceptionPlant(snapshot);
                appendExceptionEvent(exceptionId, "WORKFLOW_EXCEPTION_OPENED", snapshot);
                return exceptionWithHistory(exceptionId, false);
        }

        @Transactional
        public Map<String, Object> containWorkflowException(UUID exceptionId, Map<String, Object> request) {
                Map<String, Object> current = mutableCurrent(exceptionId);
                if ("RESOLVED".equals(cleanUpper(asString(current.get("status"))))) {
                        throw conflict("Resolved exception must be reopened before it can be contained again");
                }
                mergeText(current, request, "immediateAction", "assignedTo", "impact", "eventNote");
                current.put("status", "CONTAINED");
                current.put("workflowHold", true);
                current.put("containedBy", accessService.actor());
                current.put("containedAt", LocalDateTime.now().toString());
                touch(current);
                appendExceptionEvent(exceptionId, "WORKFLOW_EXCEPTION_CONTAINED", current);
                return exceptionWithHistory(exceptionId, false);
        }

        @Transactional
        public Map<String, Object> startWorkflowRecovery(UUID exceptionId, Map<String, Object> request) {
                Map<String, Object> current = mutableCurrent(exceptionId);
                if ("RESOLVED".equals(cleanUpper(asString(current.get("status"))))) {
                        throw conflict("Resolved exception must be reopened before recovery can restart");
                }
                mergeText(current, request,
                                "immediateAction", "assignedTo", "recoveryAction", "eventNote");
                Object recoveryResult = request == null ? null : request.get("recoveryResult");
                if (recoveryResult != null) {
                        current.put("recoveryResult", recoveryResult);
                }
                current.put("status", "RECOVERY_IN_PROGRESS");
                current.put("workflowHold", true);
                current.put("recoveryStartedBy", accessService.actor());
                current.put("recoveryStartedAt", LocalDateTime.now().toString());
                touch(current);
                appendExceptionEvent(exceptionId, "WORKFLOW_EXCEPTION_RECOVERY_STARTED", current);
                return exceptionWithHistory(exceptionId, false);
        }

        @Transactional
        public Map<String, Object> addWorkflowExceptionNote(UUID exceptionId, Map<String, Object> request) {
                Map<String, Object> current = mutableCurrent(exceptionId);
                String note = requiredText(request == null ? null : request.get("note"), "Note");
                current.put("eventNote", note);
                current.put("lastNote", note);
                current.put("lastNoteBy", accessService.actor());
                current.put("lastNoteAt", LocalDateTime.now().toString());
                touch(current);
                appendExceptionEvent(exceptionId, "WORKFLOW_EXCEPTION_NOTE", current);
                return exceptionWithHistory(exceptionId, false);
        }

        @Transactional
        public Map<String, Object> resolveWorkflowException(UUID exceptionId, Map<String, Object> request) {
                Map<String, Object> current = mutableCurrent(exceptionId);
                String rootCause = requiredText(request == null ? null : request.get("rootCause"), "Root cause");
                String correctiveAction = requiredText(
                                request == null ? null : request.get("correctiveAction"), "Corrective action");
                String resolution = requiredText(request == null ? null : request.get("resolution"), "Resolution");

                current.put("rootCause", rootCause);
                current.put("correctiveAction", correctiveAction);
                current.put("resolution", resolution);
                current.put("preventiveAction", clean(asString(request == null ? null : request.get("preventiveAction"))));
                current.put("verifiedBy", clean(asString(request == null ? null : request.get("verifiedBy"))));
                current.put("verificationReference", clean(asString(request == null ? null : request.get("verificationReference"))));
                current.put("eventNote", clean(asString(request == null ? null : request.get("eventNote"))));
                current.put("status", "RESOLVED");
                current.put("workflowHold", false);
                current.put("resolvedBy", accessService.actor());
                current.put("resolvedAt", LocalDateTime.now().toString());
                touch(current);
                appendExceptionEvent(exceptionId, "WORKFLOW_EXCEPTION_RESOLVED", current);
                return exceptionWithHistory(exceptionId, false);
        }

        @Transactional
        public Map<String, Object> reopenWorkflowException(UUID exceptionId, Map<String, Object> request) {
                Map<String, Object> current = mutableCurrent(exceptionId);
                if (!"RESOLVED".equals(cleanUpper(asString(current.get("status"))))) {
                        throw conflict("Only a resolved exception can be reopened");
                }
                String reason = requiredText(request == null ? null : request.get("reason"), "Reopen reason");
                current.put("status", "OPEN");
                current.put("workflowHold", asBoolean(request == null ? null : request.get("workflowHold"), true));
                current.put("reopenReason", reason);
                current.put("eventNote", reason);
                current.put("reopenedBy", accessService.actor());
                current.put("reopenedAt", LocalDateTime.now().toString());
                current.remove("resolvedBy");
                current.remove("resolvedAt");
                touch(current);
                appendExceptionEvent(exceptionId, "WORKFLOW_EXCEPTION_REOPENED", current);
                return exceptionWithHistory(exceptionId, false);
        }

        @Transactional(readOnly = true)
        public boolean isRequisitionBlocked(UUID requisitionId) {
                if (requisitionId == null) {
                        return false;
                }
                return blockingExceptionForRequisition(requisitionId) != null;
        }

        @Transactional(readOnly = true)
        public boolean isBomBlocked(UUID bomId) {
                if (bomId == null) {
                        return false;
                }
                String wanted = bomId.toString();
                for (Map<String, Object> snapshot : latestExceptionSnapshots(false)) {
                        if (!isBlocking(snapshot)) {
                                continue;
                        }
                        if (wanted.equals(asString(snapshot.get("bomId")))) {
                                return true;
                        }
                }
                return false;
        }

        @Transactional(readOnly = true)
        public void assertRequisitionNotBlocked(UUID requisitionId, String action) {
                Map<String, Object> blockedBy = blockingExceptionForRequisition(requisitionId);
                if (blockedBy == null) {
                        return;
                }
                throw new ResponseStatusException(
                                HttpStatus.LOCKED,
                                "MatFlow workflow is on hold by "
                                                + asString(blockedBy.get("exceptionNumber"))
                                                + ". Resolve or release the exception before attempting to "
                                                + (clean(action) == null ? "continue this workflow" : action)
                                                + ". Reason: " + asString(blockedBy.get("whatHappened")));
        }

        @Transactional(readOnly = true)
        public void assertBomNotBlocked(UUID bomId, String action) {
                if (bomId == null) {
                        return;
                }
                String wanted = bomId.toString();
                for (Map<String, Object> snapshot : latestExceptionSnapshots(false)) {
                        if (isBlocking(snapshot) && wanted.equals(asString(snapshot.get("bomId")))) {
                                throw new ResponseStatusException(
                                                HttpStatus.LOCKED,
                                                "BOM workflow is on hold by "
                                                                + asString(snapshot.get("exceptionNumber"))
                                                                + ". Correct/revise the BOM and resolve the exception before attempting to "
                                                                + (clean(action) == null ? "continue" : action)
                                                                + ". Reason: " + asString(snapshot.get("whatHappened")));
                        }
                }
        }

        /**
         * Generates a management-ready PDF for the currently filtered Operational
         * Exception & Recovery Register. The report is produced from the same
         * append-only audit snapshots used by the UI, so Excel/PDF and screen data
         * cannot drift into separate sources of truth.
         */
        @Transactional(readOnly = true)
        public byte[] workflowExceptionRegisterPdf(
                        String plantCode,
                        String status,
                        String severity,
                        String search) {
                List<Map<String, Object>> rows = listWorkflowExceptions(
                                plantCode,
                                status,
                                severity,
                                search);
                return buildExceptionRegisterPdf(rows, plantCode, status, severity, search);
        }

        /** Generates the full case-file PDF, including CAPA and immutable timeline. */
        @Transactional(readOnly = true)
        public byte[] workflowExceptionCasePdf(UUID exceptionId) {
                Map<String, Object> row = getWorkflowException(exceptionId);
                return buildExceptionCasePdf(row);
        }

        private byte[] buildExceptionRegisterPdf(
                        List<Map<String, Object>> rows,
                        String plantCode,
                        String status,
                        String severity,
                        String search) {
                List<Map<String, Object>> safeRows = rows == null ? List.of() : rows;
                long open = safeRows.stream()
                                .filter(row -> !"RESOLVED".equals(cleanUpper(asString(row.get("status")))))
                                .count();
                long holds = safeRows.stream()
                                .filter(row -> !"RESOLVED".equals(cleanUpper(asString(row.get("status")))))
                                .filter(row -> asBoolean(row.get("workflowHold"), false))
                                .count();
                long severe = safeRows.stream()
                                .filter(row -> !"RESOLVED".equals(cleanUpper(asString(row.get("status")))))
                                .filter(row -> {
                                        String value = cleanUpper(asString(row.get("severity")));
                                        return "HIGH".equals(value) || "CRITICAL".equals(value);
                                })
                                .count();
                long resolved = safeRows.stream()
                                .filter(row -> "RESOLVED".equals(cleanUpper(asString(row.get("status")))))
                                .count();

                try (PDDocument document = new PDDocument()) {
                        PdfCursor cursor = new PdfCursor(document, new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth()));
                        cursor.newPage();
                        drawRegisterHeader(
                                        cursor,
                                        plantCode,
                                        status,
                                        severity,
                                        search,
                                        safeRows.size(),
                                        open,
                                        holds,
                                        severe,
                                        resolved);

                        if (safeRows.isEmpty()) {
                                cursor.ensure(45f);
                                cursor.text("No exception records match the selected filters.", 10f, false, 40f);
                        } else {
                                int index = 1;
                                for (Map<String, Object> row : safeRows) {
                                        float required = estimateRegisterCaseHeight(row);
                                        if (!cursor.hasSpace(required)) {
                                                cursor.newPage();
                                                drawRegisterContinuationHeader(cursor);
                                        }
                                        drawRegisterCase(cursor, row, index++);
                                }
                        }

                        cursor.close();
                        addPdfFooters(document, "Operational Exception & Recovery Register");
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        document.save(out);
                        return out.toByteArray();
                } catch (IOException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.INTERNAL_SERVER_ERROR,
                                        "Unable to generate Operational Exception & Recovery PDF report",
                                        exception);
                }
        }

        private byte[] buildExceptionCasePdf(Map<String, Object> row) {
                if (row == null || row.isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "MatFlow workflow exception not found");
                }

                try (PDDocument document = new PDDocument()) {
                        PdfCursor cursor = new PdfCursor(document, PDRectangle.A4);
                        cursor.newPage();

                        String exceptionNumber = pdfValue(row.get("exceptionNumber"));
                        cursor.fillBar(new Color(15, 23, 42), 58f);
                        cursor.textAt("ALSORG / MATFLOW", 32f, cursor.pageTop() - 23f, 16f, true, Color.WHITE);
                        cursor.textAt("Operational Exception & Recovery Case File", 32f, cursor.pageTop() - 43f, 11f, false, Color.WHITE);
                        cursor.y = cursor.pageTop() - 76f;

                        cursor.section("CASE CONTROL");
                        cursor.kv("Exception", exceptionNumber);
                        cursor.kv("Status / Severity", pdfValue(row.get("status")) + " / " + pdfValue(row.get("severity")));
                        cursor.kv("Workflow Hold", asBoolean(row.get("workflowHold"), false) ? "YES" : "NO");
                        cursor.kv("Plant / PD No. / Drawing",
                                        joinPdf(" · ", row.get("plantCode"), row.get("projectCode"), row.get("drawingNo")));
                        cursor.kv("Product / Material",
                                        joinPdf(" · ", row.get("productName"), row.get("materialCode"), row.get("materialName")));
                        cursor.kv("Linked MR / BOM",
                                        joinPdf(" · ", row.get("requisitionNumber"), row.get("bomNumber")));
                        cursor.kv("Category / Detected Stage",
                                        joinPdf(" · ", row.get("category"), row.get("detectedStage")));
                        cursor.kv("Detected By / Source Record Owner",
                                        joinPdf(" · ", row.get("detectedBy"), row.get("sourceActor")));
                        cursor.kv("Created / Last Updated",
                                        joinPdf(" · ", row.get("createdAt"), row.get("updatedAt")));

                        cursor.section("WHAT HAPPENED");
                        cursor.paragraph(pdfValue(row.get("whatHappened")));
                        cursor.kv("Expected", pdfValue(row.get("expectedValue")));
                        cursor.kv("Actual / Found", pdfValue(row.get("actualValue")));
                        cursor.kv("Impact", pdfValue(row.get("impact")));
                        cursor.kv("Estimated Delay (minutes)", pdfValue(row.get("delayMinutes")));
                        cursor.kv("Immediate Containment", pdfValue(row.get("immediateAction")));
                        cursor.kv("Assigned Owner / Team", pdfValue(row.get("assignedTo")));

                        Object recoveryPlan = row.get("recoveryPlan");
                        if (recoveryPlan instanceof Collection<?> collection && !collection.isEmpty()) {
                                cursor.section("RECOVERY PLAN");
                                int step = 1;
                                for (Object item : collection) {
                                        cursor.bullet(step++ + ". " + pdfValue(item));
                                }
                        }
                        if (clean(asString(row.get("recoveryAction"))) != null
                                        || row.get("recoveryResult") != null) {
                                cursor.section("RECOVERY EXECUTION");
                                cursor.kv("Recovery Action", pdfValue(row.get("recoveryAction")));
                                cursor.kv("Recovery Result", pdfValue(row.get("recoveryResult")));
                        }

                        boolean hasClosure = "RESOLVED".equals(cleanUpper(asString(row.get("status"))))
                                        || clean(asString(row.get("rootCause"))) != null
                                        || clean(asString(row.get("correctiveAction"))) != null;
                        if (hasClosure) {
                                cursor.section("ROOT CAUSE / CAPA / CLOSURE");
                                cursor.kv("Root Cause", pdfValue(row.get("rootCause")));
                                cursor.kv("Corrective Action", pdfValue(row.get("correctiveAction")));
                                cursor.kv("Preventive Action", pdfValue(row.get("preventiveAction")));
                                cursor.kv("Verified By", joinPdf(" · ", row.get("verifiedBy"), row.get("resolvedBy")));
                                cursor.kv("Verification Reference", pdfValue(row.get("verificationReference")));
                                cursor.kv("Resolution", pdfValue(row.get("resolution")));
                                cursor.kv("Resolved At", pdfValue(row.get("resolvedAt")));
                        }

                        Object accountability = row.get("accountabilityTrailAtDetection");
                        if (accountability instanceof Collection<?> collection && !collection.isEmpty()) {
                                cursor.section("SYSTEM ACCOUNTABILITY TRAIL AT DETECTION");
                                cursor.paragraph("Recorded participation is evidence of who performed which system action; it is not an automatic fault verdict.");
                                int count = 0;
                                for (Object item : collection) {
                                        if (!(item instanceof Map<?, ?> event)) {
                                                continue;
                                        }
                                        if (count++ >= 100) {
                                                cursor.bullet("Additional accountability events omitted after 100 rows.");
                                                break;
                                        }
                                        cursor.bullet(joinPdf(" | ",
                                                        event.get("actionAt"),
                                                        event.get("entityType"),
                                                        event.get("action"),
                                                        event.get("actor"),
                                                        event.get("projectCode"),
                                                        event.get("drawingNo")));
                                }
                        }

                        Object history = row.get("history");
                        if (history instanceof Collection<?> collection && !collection.isEmpty()) {
                                cursor.section("IMMUTABLE EXCEPTION EVENT TIMELINE");
                                for (Object item : collection) {
                                        if (!(item instanceof Map<?, ?> event)) {
                                                continue;
                                        }
                                        cursor.bullet(joinPdf(" | ",
                                                        event.get("actionAt"),
                                                        event.get("action"),
                                                        event.get("actor"),
                                                        event.get("status"),
                                                        event.get("note")));
                                }
                        }

                        cursor.close();
                        addPdfFooters(document, exceptionNumber);
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        document.save(out);
                        return out.toByteArray();
                } catch (IOException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.INTERNAL_SERVER_ERROR,
                                        "Unable to generate Operational Exception case PDF",
                                        exception);
                }
        }

        private void drawRegisterHeader(
                        PdfCursor cursor,
                        String plantCode,
                        String status,
                        String severity,
                        String search,
                        int total,
                        long open,
                        long holds,
                        long severe,
                        long resolved) throws IOException {
                cursor.fillBar(new Color(15, 23, 42), 52f);
                cursor.textAt("ALSORG / MATFLOW", 26f, cursor.pageTop() - 20f, 15f, true, Color.WHITE);
                cursor.textAt("Operational Exception & Recovery Register", 26f, cursor.pageTop() - 39f, 11f, false, Color.WHITE);
                cursor.y = cursor.pageTop() - 66f;
                cursor.text("Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm")), 8f, false, 11f);
                cursor.text("Filters: Plant=" + printableFilter(plantCode)
                                + "  |  Status=" + printableFilter(status)
                                + "  |  Severity=" + printableFilter(severity)
                                + "  |  Search=" + printableFilter(search), 8f, false, 12f);
                cursor.text("Total " + total + "   |   Open " + open + "   |   Holds " + holds
                                + "   |   High/Critical " + severe + "   |   Resolved " + resolved,
                                9f, true, 17f);
                cursor.line();
        }

        private void drawRegisterContinuationHeader(PdfCursor cursor) throws IOException {
                cursor.text("Operational Exception & Recovery Register — Continued", 11f, true, 17f);
                cursor.line();
        }

        private float estimateRegisterCaseHeight(Map<String, Object> row) {
                int narrative = Math.max(1, wrapPdf(pdfValue(row.get("whatHappened")), 58).size());
                int closure = Math.max(1, wrapPdf(joinPdf(" / ", row.get("rootCause"), row.get("correctiveAction")), 52).size());
                return 58f + (narrative * 8f) + Math.min(closure, 3) * 8f;
        }

        private void drawRegisterCase(PdfCursor cursor, Map<String, Object> row, int index) throws IOException {
                float startY = cursor.y;
                cursor.text(index + ".  " + pdfValue(row.get("exceptionNumber"))
                                + "    " + pdfValue(row.get("severity"))
                                + " / " + pdfValue(row.get("status"))
                                + (asBoolean(row.get("workflowHold"), false) ? "    [WORKFLOW HOLD]" : ""),
                                9.5f, true, 13f);
                cursor.text("Plant/PD/Drawing: " + joinPdf(" · ", row.get("plantCode"), row.get("projectCode"), row.get("drawingNo"))
                                + "    |    Linked: " + joinPdf(" · ", row.get("requisitionNumber"), row.get("bomNumber")),
                                7.5f, false, 10f);
                cursor.text("Category/Stage: " + joinPdf(" · ", row.get("category"), row.get("detectedStage"))
                                + "    |    Detected: " + pdfValue(row.get("detectedBy"))
                                + "    |    Source owner: " + pdfValue(row.get("sourceActor")),
                                7.5f, false, 10f);
                cursor.wrapped("What happened: " + pdfValue(row.get("whatHappened")), 7.5f, false, 115, 8.5f);
                String compare = joinPdf(" | ",
                                clean(asString(row.get("expectedValue"))) == null ? null : "Expected: " + asString(row.get("expectedValue")),
                                clean(asString(row.get("actualValue"))) == null ? null : "Actual: " + asString(row.get("actualValue")),
                                clean(asString(row.get("impact"))) == null ? null : "Impact: " + asString(row.get("impact")));
                if (!"-".equals(compare)) {
                        cursor.wrapped(compare, 7f, false, 118, 8f);
                }
                String closure = joinPdf(" | ",
                                clean(asString(row.get("rootCause"))) == null ? null : "Root cause: " + asString(row.get("rootCause")),
                                clean(asString(row.get("correctiveAction"))) == null ? null : "Corrective: " + asString(row.get("correctiveAction")),
                                clean(asString(row.get("resolution"))) == null ? null : "Resolution: " + asString(row.get("resolution")));
                if (!"-".equals(closure)) {
                        cursor.wrapped(closure, 7f, false, 118, 8f);
                }
                cursor.text("Updated: " + pdfValue(firstNonBlank(row.get("updatedAt"), row.get("createdAt")))
                                + "    |    Assigned: " + pdfValue(row.get("assignedTo")),
                                7f, false, 9f);
                cursor.strokeBox(cursor.margin, cursor.y - 2f, cursor.contentWidth(), startY - cursor.y + 4f, new Color(203, 213, 225));
                cursor.y -= 8f;
        }

        private void addPdfFooters(PDDocument document, String label) throws IOException {
                int totalPages = document.getNumberOfPages();
                for (int index = 0; index < totalPages; index++) {
                        PDPage page = document.getPage(index);
                        try (PDPageContentStream stream = new PDPageContentStream(
                                        document, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                                stream.setNonStrokingColor(new Color(100, 116, 139));
                                stream.setFont(PDType1Font.HELVETICA, 7f);
                                stream.beginText();
                                stream.newLineAtOffset(24f, 14f);
                                stream.showText(pdfSafe(label) + "  |  Page " + (index + 1) + " of " + totalPages);
                                stream.endText();
                        }
                }
        }

        private String printableFilter(String value) {
                String clean = clean(value);
                return clean == null ? "ALL" : clean;
        }

        private String pdfValue(Object value) {
                if (value == null) {
                        return "-";
                }
                if (value instanceof Collection<?> collection) {
                        if (collection.isEmpty()) {
                                return "-";
                        }
                        return collection.stream().map(this::pdfValue).filter(item -> !"-".equals(item))
                                        .reduce((left, right) -> left + ", " + right).orElse("-");
                }
                if (value instanceof Map<?, ?> map) {
                        try {
                                return objectMapper.writeValueAsString(map);
                        } catch (Exception ignored) {
                                return String.valueOf(value);
                        }
                }
                String text = clean(String.valueOf(value));
                return text == null ? "-" : text;
        }

        private String joinPdf(String delimiter, Object... values) {
                List<String> parts = new ArrayList<>();
                if (values != null) {
                        for (Object value : values) {
                                String text = pdfValue(value);
                                if (!"-".equals(text)) {
                                        parts.add(text);
                                }
                        }
                }
                return parts.isEmpty() ? "-" : String.join(delimiter, parts);
        }

        private static String pdfSafe(String value) {
                if (value == null) {
                        return "";
                }
                return value
                                .replace('\u2013', '-')
                                .replace('\u2014', '-')
                                .replace('\u2018', '\'')
                                .replace('\u2019', '\'')
                                .replace('\u201c', '"')
                                .replace('\u201d', '"')
                                .replace('\u2022', '-')
                                .replace('\u2192', '>')
                                .replaceAll("[^\\x20-\\x7E]", "?");
        }

        private static List<String> wrapPdf(String value, int maxChars) {
                String text = pdfSafe(value == null ? "" : value).trim();
                if (text.isEmpty()) {
                        return List.of("-");
                }
                List<String> lines = new ArrayList<>();
                for (String paragraph : text.split("\\R", -1)) {
                        String working = paragraph.trim();
                        if (working.isEmpty()) {
                                lines.add("");
                                continue;
                        }
                        while (working.length() > maxChars) {
                                int cut = working.lastIndexOf(' ', maxChars);
                                if (cut < Math.max(8, maxChars / 2)) {
                                        cut = maxChars;
                                }
                                lines.add(working.substring(0, cut).trim());
                                working = working.substring(cut).trim();
                        }
                        lines.add(working);
                }
                return lines;
        }

        /** Minimal PDFBox writer kept inside this existing service to avoid new files. */
        private static final class PdfCursor {
                private final PDDocument document;
                private final PDRectangle size;
                private final PDFont regular = PDType1Font.HELVETICA;
                private final PDFont bold = PDType1Font.HELVETICA_BOLD;
                private final float margin = 26f;
                private PDPage page;
                private PDPageContentStream stream;
                private float y;

                PdfCursor(PDDocument document, PDRectangle size) {
                        this.document = document;
                        this.size = size;
                }

                float pageTop() {
                        return size.getHeight();
                }

                float contentWidth() {
                        return size.getWidth() - (margin * 2f);
                }

                boolean hasSpace(float height) {
                        return y - height > 30f;
                }

                void ensure(float height) throws IOException {
                        if (!hasSpace(height)) {
                                newPage();
                        }
                }

                void newPage() throws IOException {
                        closeStream();
                        page = new PDPage(size);
                        document.addPage(page);
                        stream = new PDPageContentStream(document, page);
                        y = size.getHeight() - margin;
                }

                void fillBar(Color color, float height) throws IOException {
                        stream.setNonStrokingColor(color);
                        stream.addRect(0f, size.getHeight() - height, size.getWidth(), height);
                        stream.fill();
                }

                void text(String value, float fontSize, boolean strong, float leading) throws IOException {
                        ensure(leading + 3f);
                        textAt(value, margin, y, fontSize, strong, Color.BLACK);
                        y -= leading;
                }

                void wrapped(String value, float fontSize, boolean strong, int maxChars, float leading) throws IOException {
                        for (String line : wrapPdf(value, maxChars)) {
                                text(line, fontSize, strong, leading);
                        }
                }

                void paragraph(String value) throws IOException {
                        wrapped(value, 9f, false, 92, 11f);
                        y -= 3f;
                }

                void bullet(String value) throws IOException {
                        wrapped("- " + value, 8f, false, 90, 10f);
                }

                void section(String label) throws IOException {
                        ensure(28f);
                        y -= 5f;
                        text(label, 10f, true, 15f);
                        line();
                }

                void kv(String key, String value) throws IOException {
                        ensure(18f);
                        List<String> lines = wrapPdf(value, 72);
                        text(key + ": " + (lines.isEmpty() ? "-" : lines.get(0)), 8.5f, false, 10f);
                        for (int index = 1; index < lines.size(); index++) {
                                text("    " + lines.get(index), 8.5f, false, 10f);
                        }
                }

                void line() throws IOException {
                        ensure(5f);
                        stream.setStrokingColor(new Color(203, 213, 225));
                        stream.setLineWidth(.7f);
                        stream.moveTo(margin, y);
                        stream.lineTo(size.getWidth() - margin, y);
                        stream.stroke();
                        y -= 7f;
                }

                void strokeBox(float x, float bottom, float width, float height, Color color) throws IOException {
                        stream.setStrokingColor(color);
                        stream.setLineWidth(.6f);
                        stream.addRect(x, bottom, width, Math.max(8f, height));
                        stream.stroke();
                }

                void textAt(String value, float x, float baseline, float fontSize, boolean strong, Color color) throws IOException {
                        stream.setNonStrokingColor(color);
                        stream.setFont(strong ? bold : regular, fontSize);
                        stream.beginText();
                        stream.newLineAtOffset(x, baseline);
                        stream.showText(pdfSafe(value));
                        stream.endText();
                }

                void close() throws IOException {
                        closeStream();
                }

                private void closeStream() throws IOException {
                        if (stream != null) {
                                stream.close();
                                stream = null;
                        }
                }
        }

        private Map<String, Object> blockingExceptionForRequisition(UUID requisitionId) {
                String wanted = requisitionId.toString();
                for (Map<String, Object> snapshot : latestExceptionSnapshots(false)) {
                        if (!isBlocking(snapshot)) {
                                continue;
                        }
                        if (wanted.equals(asString(snapshot.get("requisitionId")))) {
                                return snapshot;
                        }
                        if (uuidStrings(snapshot.get("affectedRequisitionIds")).contains(wanted)) {
                                return snapshot;
                        }
                }
                return null;
        }

        private boolean isBlocking(Map<String, Object> snapshot) {
                return snapshot != null
                                && asBoolean(snapshot.get("workflowHold"), false)
                                && !"RESOLVED".equals(cleanUpper(asString(snapshot.get("status"))));
        }

        private List<Map<String, Object>> latestExceptionSnapshots(boolean enforcePlantVisibility) {
                LinkedHashMap<UUID, Map<String, Object>> latest = new LinkedHashMap<>();
                for (MatFlowAuditLog row : auditRepository
                                .findByEntityTypeOrderByActionAtDesc(WORKFLOW_EXCEPTION_ENTITY)) {
                        if (row == null || row.getEntityId() == null || latest.containsKey(row.getEntityId())) {
                                continue;
                        }
                        Map<String, Object> snapshot = parseDetails(row.getDetailsJson());
                        snapshot.put("id", row.getEntityId());
                        snapshot.put("updatedAt", row.getActionAt());
                        snapshot.put("updatedBy", row.getActor());
                        snapshot.putIfAbsent("plantCode", row.getPlantCode());
                        if (enforcePlantVisibility) {
                                String plant = cleanUpper(asString(snapshot.get("plantCode")));
                                if (plant != null && !accessService.canAccessPlant(plant)) {
                                        continue;
                                }
                        }
                        latest.put(row.getEntityId(), snapshot);
                }
                return new ArrayList<>(latest.values());
        }

        private Map<String, Object> mutableCurrent(UUID exceptionId) {
                accessService.requireRead();
                Map<String, Object> current = exceptionWithHistory(exceptionId, true);
                current.remove("history");
                current.remove("latestAction");
                current.remove("updatedBy");
                current.remove("updatedAt");
                return new LinkedHashMap<>(current);
        }

        private Map<String, Object> exceptionWithHistory(UUID exceptionId, boolean enforceVisibility) {
                if (exceptionId == null) {
                        throw badRequest("Exception ID is required");
                }
                List<MatFlowAuditLog> rows = auditRepository
                                .findByEntityTypeAndEntityIdOrderByActionAtAsc(WORKFLOW_EXCEPTION_ENTITY, exceptionId);
                if (rows.isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "MatFlow workflow exception not found");
                }

                MatFlowAuditLog latest = rows.get(rows.size() - 1);
                Map<String, Object> snapshot = parseDetails(latest.getDetailsJson());
                snapshot.put("id", exceptionId);
                snapshot.put("latestAction", latest.getAction());
                snapshot.put("updatedBy", latest.getActor());
                snapshot.put("updatedAt", latest.getActionAt());
                snapshot.putIfAbsent("plantCode", latest.getPlantCode());
                snapshot.putIfAbsent("projectCode", latest.getProjectCode());
                snapshot.putIfAbsent("drawingNo", latest.getDrawingNo());

                if (enforceVisibility) {
                        validateExceptionPlant(snapshot);
                }

                List<Map<String, Object>> history = new ArrayList<>();
                for (MatFlowAuditLog row : rows) {
                        Map<String, Object> eventSnapshot = parseDetails(row.getDetailsJson());
                        Map<String, Object> event = new LinkedHashMap<>();
                        event.put("id", row.getId());
                        event.put("action", row.getAction());
                        event.put("actor", row.getActor());
                        event.put("actionAt", row.getActionAt());
                        event.put("status", eventSnapshot.get("status"));
                        event.put("workflowHold", eventSnapshot.get("workflowHold"));
                        event.put("note", firstNonBlank(
                                        eventSnapshot.get("eventNote"),
                                        eventSnapshot.get("recoveryAction"),
                                        eventSnapshot.get("resolution"),
                                        eventSnapshot.get("immediateAction")));
                        event.put("snapshot", eventSnapshot);
                        history.add(event);
                }
                snapshot.put("history", history);
                return snapshot;
        }

        private void appendExceptionEvent(UUID exceptionId, String action, Map<String, Object> snapshot) {
                validateSnapshot(snapshot);
                record(
                                WORKFLOW_EXCEPTION_ENTITY,
                                exceptionId,
                                action,
                                asString(snapshot.get("plantCode")),
                                asString(snapshot.get("projectCode")),
                                asString(snapshot.get("drawingNo")),
                                snapshot);
        }

        private void validateSnapshot(Map<String, Object> snapshot) {
                String status = normalizeChoice(snapshot.get("status"), "OPEN", EXCEPTION_STATUSES, "Status");
                String severity = normalizeChoice(snapshot.get("severity"), "MEDIUM", EXCEPTION_SEVERITIES, "Severity");
                String category = normalizeChoice(snapshot.get("category"), "OTHER", EXCEPTION_CATEGORIES, "Category");
                snapshot.put("status", status);
                snapshot.put("severity", severity);
                snapshot.put("category", category);
                snapshot.put("whatHappened", requiredText(snapshot.get("whatHappened"), "What happened"));
                snapshot.put("workflowHold", asBoolean(snapshot.get("workflowHold"), false));
                snapshot.put("affectedRequisitionIds", uuidStrings(snapshot.get("affectedRequisitionIds")));
                validateExceptionPlant(snapshot);
        }

        private void validateExceptionPlant(Map<String, Object> snapshot) {
                String plant = cleanUpper(asString(snapshot.get("plantCode")));
                if (plant != null) {
                        accessService.requirePlantAccess(plant);
                        snapshot.put("plantCode", plant);
                }
        }

        private void touch(Map<String, Object> snapshot) {
                snapshot.put("updatedBy", accessService.actor());
                snapshot.put("updatedAt", LocalDateTime.now().toString());
        }

        private void mergeText(Map<String, Object> target, Map<String, Object> source, String... keys) {
                if (source == null || keys == null) {
                        return;
                }
                for (String key : keys) {
                        String value = clean(asString(source.get(key)));
                        if (value != null) {
                                target.put(key, value);
                        }
                }
        }

        private String exceptionSearchText(Map<String, Object> row) {
                StringBuilder builder = new StringBuilder();
                for (String key : List.of(
                                "exceptionNumber", "status", "severity", "category", "plantCode",
                                "projectCode", "drawingNo", "productName", "requisitionNumber", "bomNumber",
                                "materialCode", "materialName", "detectedStage", "detectedBy", "sourceActor",
                                "assignedTo", "whatHappened", "expectedValue", "actualValue", "impact",
                                "rootCause", "correctiveAction", "preventiveAction", "resolution")) {
                        Object value = row.get(key);
                        if (value != null) {
                                builder.append(' ').append(value);
                        }
                }
                return builder.toString().toLowerCase(Locale.ROOT);
        }

        private String exceptionNumber(UUID id) {
                String shortId = id.toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
                return "EXC/" + LocalDate.now() + "/" + shortId;
        }

        private Map<String, Object> parseDetails(String json) {
                if (json == null || json.isBlank()) {
                        return new LinkedHashMap<>();
                }
                try {
                        Map<String, Object> value = objectMapper.readValue(
                                        json, new TypeReference<Map<String, Object>>() {
                                        });
                        return value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value);
                } catch (Exception ignored) {
                        Map<String, Object> fallback = new LinkedHashMap<>();
                        fallback.put("rawDetails", json);
                        fallback.put("parseError", true);
                        return fallback;
                }
        }

        private Map<String, Object> copy(Map<String, Object> value) {
                return value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value);
        }

        private List<String> uuidStrings(Object value) {
                LinkedHashSet<String> result = new LinkedHashSet<>();
                if (value instanceof Collection<?> collection) {
                        for (Object item : collection) {
                                UUID id = asUuid(item);
                                if (id != null) {
                                        result.add(id.toString());
                                }
                        }
                } else {
                        UUID id = asUuid(value);
                        if (id != null) {
                                result.add(id.toString());
                        }
                }
                return new ArrayList<>(result);
        }

        private UUID asUuid(Object value) {
                if (value == null) {
                        return null;
                }
                String text = clean(String.valueOf(value));
                if (text == null) {
                        return null;
                }
                try {
                        return UUID.fromString(text);
                } catch (IllegalArgumentException ignored) {
                        throw badRequest("Invalid UUID value: " + text);
                }
        }

        private boolean asBoolean(Object value, boolean fallback) {
                if (value == null) {
                        return fallback;
                }
                if (value instanceof Boolean bool) {
                        return bool;
                }
                String text = clean(String.valueOf(value));
                if (text == null) {
                        return fallback;
                }
                return "TRUE".equalsIgnoreCase(text)
                                || "YES".equalsIgnoreCase(text)
                                || "1".equals(text);
        }

        private String normalizeChoice(
                        Object raw,
                        String fallback,
                        Set<String> allowed,
                        String field) {
                String value = cleanUpper(asString(raw));
                if (value == null) {
                        value = fallback;
                }
                if (!allowed.contains(value)) {
                        throw badRequest(field + " must be one of: " + String.join(", ", allowed));
                }
                return value;
        }

        private String requiredText(Object value, String field) {
                String text = clean(asString(value));
                if (text == null) {
                        throw badRequest(field + " is required");
                }
                return text;
        }

        private Object firstNonBlank(Object... values) {
                if (values == null) {
                        return null;
                }
                for (Object value : values) {
                        String text = clean(asString(value));
                        if (text != null) {
                                return text;
                        }
                }
                return null;
        }

        private String asString(Object value) {
                return value == null ? null : String.valueOf(value);
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
                return result == null ? null : result.toUpperCase(Locale.ROOT);
        }

        private String clean(String value) {
                if (value == null) {
                        return null;
                }
                String result = value.trim();
                return result.isBlank() ? null : result;
        }

        private ResponseStatusException badRequest(String message) {
                return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }

        private ResponseStatusException conflict(String message) {
                return new ResponseStatusException(HttpStatus.CONFLICT, message);
        }
}
