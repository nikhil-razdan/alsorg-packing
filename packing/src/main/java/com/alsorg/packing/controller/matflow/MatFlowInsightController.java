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
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Plant/custody reporting. No generic Location filter is exposed. */
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
        return service.stockLedger(plantCode, materialId, movementType, fromDate, toDate, search, page, size);
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
        return service.auditLogs(plantCode, entityType, entityId, action, fromDate, toDate, search, page, size);
    }

    @GetMapping("/tracker")
    public TrackerResponse tracker(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String stage) {
        return service.tracker(search, plantCode, stage);
    }

    @GetMapping("/tracker/requisitions/{requisitionId}")
    public TrackerDetailResponse trackerDetail(@PathVariable UUID requisitionId) {
        return service.trackerDetail(requisitionId);
    }

    @GetMapping("/admin/integrity")
    public IntegrityReport integrity(@RequestParam(required = false) String plantCode) {
        return service.inspectIntegrity(plantCode);
    }
}
