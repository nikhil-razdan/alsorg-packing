package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegrityReport;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.AuditLogRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.DashboardResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.PageResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.ProjectTrackingResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.ShortageAgeingRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.StockLedgerRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.service.matflow.MatFlowInsightService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Plant/material reporting plus the integrated Operational Exception & Recovery Register. */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowInsightController {
    private final MatFlowInsightService service;

    public MatFlowInsightController(MatFlowInsightService service) {
        this.service = service;
    }

    @GetMapping("/reports/dashboard")
    public DashboardResponse dashboard(@RequestParam(required = false) String plantCode) {
        validateText(plantCode, 32, "Plant code");
        return service.dashboard(plantCode);
    }

    @GetMapping("/reports/products/{projectDrawingId}")
    public ProjectTrackingResponse project(
            @PathVariable UUID projectDrawingId) {
        return service.projectTracking(projectDrawingId);
    }

    @GetMapping("/reports/shortages")
    public List<ShortageAgeingRow> shortages(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) Integer minimumAgeDays) {
        validateText(plantCode, 32, "Plant code");
        if (minimumAgeDays != null && (minimumAgeDays < 0 || minimumAgeDays > 36500)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum age days is out of range");
        }
        return service.shortageAgeing(plantCode, minimumAgeDays);
    }

    @GetMapping("/reports/stock-ledger")
    public PageResponse<StockLedgerRow> stockLedger(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) UUID materialId,
            @RequestParam(required = false) MovementType movementType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        validateText(plantCode, 32, "Plant code");
        validateText(search, 300, "Search");
        validateDateRange(fromDate, toDate);
        return service.stockLedger(
                plantCode,
                materialId,
                movementType,
                fromDate,
                toDate,
                search,
                Math.max(page, 0),
                normalizePageSize(size));
    }

    @GetMapping("/reports/audit")
    public PageResponse<AuditLogRow> audit(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        validateText(plantCode, 32, "Plant code");
        validateText(entityType, 100, "Entity type");
        validateText(action, 120, "Action");
        validateText(search, 300, "Search");
        validateDateRange(fromDate, toDate);
        return service.auditLogs(
                plantCode,
                entityType,
                entityId,
                action,
                fromDate,
                toDate,
                search,
                Math.max(page, 0),
                normalizePageSize(size));
    }

    /**
     * Production Execution readiness is the Production-facing alias of the
     * tracker list. The frontend intentionally uses a semantic endpoint so the
     * Production workspace is decoupled from the general Tracker route while
     * both continue to share the same authoritative read model.
     */
    @GetMapping("/production-readiness")
    public TrackerResponse productionReadiness(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode) {
        validateText(search, 300, "Search");
        validateText(plantCode, 32, "Plant code");
        return service.productionReadiness(search, plantCode);
    }

    @GetMapping("/tracker")
    public TrackerResponse tracker(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String stage) {
        validateText(search, 300, "Search");
        validateText(plantCode, 32, "Plant code");
        validateText(stage, 100, "Stage");
        return service.tracker(search, plantCode, stage);
    }

    @GetMapping("/tracker/requisitions/{requisitionId}")
    public TrackerDetailResponse trackerDetail(@PathVariable UUID requisitionId) {
        return service.trackerDetail(requisitionId);
    }

    @GetMapping("/admin/integrity")
    public IntegrityReport integrity(@RequestParam(required = false) String plantCode) {
        validateText(plantCode, 32, "Plant code");
        return service.inspectIntegrity(plantCode);
    }

    /* ---------------- Operational Exception & Recovery Register ---------------- */

    @GetMapping("/exceptions")
    public List<Map<String, Object>> exceptions(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String search) {
        validateExceptionFilters(plantCode, status, severity, search);
        return service.workflowExceptions(plantCode, status, severity, search);
    }

    @GetMapping(value = "/exceptions/report.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exceptionRegisterPdf(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String search) {
        validateExceptionFilters(plantCode, status, severity, search);
        byte[] pdf = service.workflowExceptionsPdf(plantCode, status, severity, search);
        return pdfResponse(pdf, "MATFLOW_Operational_Exception_Recovery_Register.pdf");
    }

    @GetMapping(value = "/exceptions/{id}/report.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exceptionCasePdf(@PathVariable UUID id) {
        byte[] pdf = service.workflowExceptionPdf(id);
        return pdfResponse(pdf, "MATFLOW_Exception_" + id + ".pdf");
    }

    @GetMapping("/exceptions/{id}")
    public Map<String, Object> exception(@PathVariable UUID id) {
        return service.workflowException(id);
    }

    @PostMapping("/exceptions")
    public Map<String, Object> openException(@RequestBody Map<String, Object> request) {
        return service.openWorkflowException(request);
    }

    @PostMapping("/exceptions/{id}/contain")
    public Map<String, Object> containException(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, Object> request) {
        return service.containWorkflowException(id, request);
    }

    @PostMapping("/exceptions/{id}/recovery")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER')")
    public Map<String, Object> startRecovery(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, Object> request) {
        return service.startWorkflowExceptionRecovery(id, request);
    }

    @PostMapping("/exceptions/{id}/notes")
    public Map<String, Object> addExceptionNote(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> request) {
        return service.addWorkflowExceptionNote(id, request);
    }

    @PostMapping("/exceptions/{id}/resolve")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER')")
    public Map<String, Object> resolveException(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> request) {
        return service.resolveWorkflowException(id, request);
    }

    @PostMapping("/exceptions/{id}/reopen")
    @PreAuthorize("hasAnyAuthority('ADMIN','MATFLOW_MANAGER')")
    public Map<String, Object> reopenException(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> request) {
        return service.reopenWorkflowException(id, request);
    }
    private void validateExceptionFilters(
            String plantCode,
            String status,
            String severity,
            String search) {
        validateText(plantCode, 32, "Plant code");
        validateText(status, 64, "Status");
        validateText(severity, 64, "Severity");
        validateText(search, 300, "Search");
    }

    private void validateText(
            String value,
            int maxLength,
            String fieldName) {
        if (value != null && value.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    fieldName + " cannot exceed " + maxLength + " characters");
        }
    }

    private void validateDateRange(
            LocalDateTime fromDate,
            LocalDateTime toDate) {
        if (fromDate != null && toDate != null && toDate.isBefore(fromDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "To date cannot be before From date");
        }
    }

    private int normalizePageSize(int size) {
        return Math.min(Math.max(size, 1), 100);
    }

    private ResponseEntity<byte[]> pdfResponse(byte[] pdf, String fileName) {
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(fileName)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                .body(pdf);
    }

}

