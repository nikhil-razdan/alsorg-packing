package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.service.CombinedReportService;
import com.alsorg.packing.reporting.service.DispatchReportService;
import com.alsorg.packing.reporting.service.InventoryReportWorkbookService;
import com.alsorg.packing.reporting.service.PackingReportService;
import com.alsorg.packing.reporting.service.ReportExportService;

@RestController
@RequestMapping("/api/reports/export")
@PreAuthorize("isAuthenticated()")
public class ReportExportController {

    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    private static final MediaType CSV = MediaType.parseMediaType(
            "text/csv;charset=UTF-8");

    private final DispatchReportService dispatchService;
    private final PackingReportService packingService;
    private final ReportExportService exportService;
    private final CombinedReportService combinedService;
    private final InventoryReportWorkbookService workbookService;

    public ReportExportController(
            DispatchReportService dispatchService,
            ReportExportService exportService,
            PackingReportService packingService,
            InventoryReportWorkbookService workbookService,
            CombinedReportService combinedService) {
        this.dispatchService = dispatchService;
        this.exportService = exportService;
        this.packingService = packingService;
        this.combinedService = combinedService;
        this.workbookService = workbookService;
    }

    @GetMapping("/dispatch/csv")
    public ResponseEntity<byte[]> exportDispatchCsv(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        List<DispatchReportRow> rows = dispatchService.getDispatchReport(from, to);
        byte[] csv = exportService.exportDispatchCsv(rows);
        return fileResponse(csv, "dispatch-report.csv", CSV);
    }

    @GetMapping("/dispatch/excel")
    public ResponseEntity<byte[]> exportDispatchExcel(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        byte[] excel = workbookService.exportInventoryReport(
                "dispatch",
                from,
                to);
        return fileResponse(excel, "Dispatch Register.xlsx", XLSX);
    }

    @GetMapping("/packing/csv")
    public ResponseEntity<byte[]> exportPackingCsv(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        List<PackingReportRow> rows = packingService.getPackingReport(from, to);
        byte[] csv = exportService.exportPackingCsv(rows);
        return fileResponse(csv, "packing-report.csv", CSV);
    }

    @GetMapping("/packing/excel")
    public ResponseEntity<byte[]> exportPackingExcel(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        byte[] excel = workbookService.exportInventoryReport(
                "packing",
                from,
                to);
        return fileResponse(excel, "packing-professional-report.xlsx", XLSX);
    }

    @GetMapping("/combined/excel")
    public ResponseEntity<byte[]> exportCombinedExcel(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        /*
         * Keep the existing endpoint contract: combined export currently maps
         * to the professional inventory workbook.
         */
        byte[] excel = workbookService.exportInventoryReport(
                "inventory",
                from,
                to);
        return fileResponse(excel, "Inventory Director BI Report.xlsx", XLSX);
    }

    @GetMapping("/inventory/excel")
    public ResponseEntity<byte[]> exportInventoryExcel(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to) {
        byte[] excel = workbookService.exportInventoryReport(
                "inventory",
                from,
                to);
        return fileResponse(excel, "Inventory Director BI Report.xlsx", XLSX);
    }

    private ResponseEntity<byte[]> fileResponse(
            byte[] body,
            String filename,
            MediaType mediaType) {
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
                .contentType(mediaType)
                .body(body);
    }
}
