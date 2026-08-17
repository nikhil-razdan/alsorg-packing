package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIntegrityDtos.IntegrityReport;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.AuditLogRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.DashboardResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.PageResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.ProjectTrackingResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.ShortageAgeingRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowReportingDtos.StockLedgerRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowTrackerDtos.TrackerDetailResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.service.matflow.MatFlowInsightService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Consolidated read-model controller for dashboard/reporting, Production
 * readiness, material tracking and integrity diagnostics. Internal custody
 * transfers are read-model inputs only; they are not a public workflow desk.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowInsightController {

    private final MatFlowInsightService service;

    public MatFlowInsightController(MatFlowInsightService service) {
        this.service = service;
    }

    /* -------------------- Reports -------------------- */

    @GetMapping("/reports/dashboard")
    public DashboardResponse dashboard(
            @RequestParam(required = false) String plantCode) {
        return service.dashboard(plantCode);
    }

    @GetMapping("/reports/products/{projectDrawingId}")
    public ProjectTrackingResponse projectTracking(
            @PathVariable UUID projectDrawingId) {
        return service.projectTracking(projectDrawingId);
    }

    @GetMapping("/reports/shortages")
    public List<ShortageAgeingRow> shortages(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) Integer minimumAgeDays) {
        return service.shortageAgeing(plantCode, minimumAgeDays);
    }

    @GetMapping("/reports/stock-ledger")
    public PageResponse<StockLedgerRow> stockLedger(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) UUID materialId,
            @RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) MovementType movementType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return service.stockLedger(
                plantCode,
                materialId,
                locationId,
                movementType,
                fromDate,
                toDate,
                search,
                page,
                size);
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
        return service.auditLogs(
                plantCode,
                entityType,
                entityId,
                action,
                fromDate,
                toDate,
                search,
                page,
                size);
    }

    /* -------------------- Smart tracker -------------------- */

    /**
     * Production Execution read model.
     *
     * This endpoint is intentionally kept separate from /tracker because the
     * Production Execution workspace has a stable API contract at
     * GET /api/matflow/production-readiness.
     */
    @GetMapping("/production-readiness")
    public TrackerResponse productionReadiness(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode) {
        return service.tracker(search, plantCode, null);
    }

    @GetMapping("/tracker")
    public TrackerResponse tracker(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String stage) {
        return service.tracker(search, plantCode, stage);
    }

    /**
     * Full requisition/project/material control-tower timeline.
     */
    @GetMapping("/tracker/requisitions/{requisitionId}")
    public TrackerDetailResponse trackerDetail(
            @PathVariable UUID requisitionId) {
        return service.trackerDetail(requisitionId);
    }

    /* -------------------- Integrity -------------------- */

    @GetMapping("/admin/integrity")
    public IntegrityReport integrity(
            @RequestParam(required = false) String plantCode) {
        return service.inspectIntegrity(plantCode);
    }
}
