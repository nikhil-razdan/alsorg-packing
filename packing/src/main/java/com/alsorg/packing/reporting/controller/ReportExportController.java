package com.alsorg.packing.reporting.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.reporting.dto.DispatchReportRow;
import com.alsorg.packing.reporting.dto.PackingReportRow;
import com.alsorg.packing.reporting.service.CombinedReportService;
import com.alsorg.packing.reporting.service.DispatchReportService;
import com.alsorg.packing.reporting.service.PackingReportService;
import com.alsorg.packing.reporting.service.ReportExportService;

@RestController
@RequestMapping("/api/reports/export")
public class ReportExportController {

    private final DispatchReportService dispatchService;
    private final PackingReportService packingService;
    private final ReportExportService exportService;
    private final CombinedReportService combinedService;

    public ReportExportController(
            DispatchReportService dispatchService,
            ReportExportService exportService,
            PackingReportService packingService,
            CombinedReportService combinedService
    ) {
        this.dispatchService = dispatchService;
        this.exportService = exportService;
        this.packingService = packingService;
        this.combinedService = combinedService;
    }

    @GetMapping("/dispatch/csv")
    public ResponseEntity<byte[]> exportDispatchCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        List<DispatchReportRow> rows =
                dispatchService.getDispatchReport(from, to);

        byte[] csv = exportService.exportDispatchCsv(rows);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=dispatch-report.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv);
    }
    @GetMapping("/dispatch/excel")
    public ResponseEntity<byte[]> exportDispatchExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        var rows = dispatchService.getDispatchReport(from, to);
        byte[] excel = exportService.exportDispatchExcel(rows);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=dispatch-report.xlsx")
                .contentType(
                    MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                )
                .body(excel);
    }
    @GetMapping("/packing/csv")
    public ResponseEntity<byte[]> exportPackingCsv(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        List<PackingReportRow> rows =
                packingService.getPackingReport(from, to);

        byte[] csv = exportService.exportPackingCsv(rows);

        return ResponseEntity.ok()
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=packing-report.csv"
                )
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv);
    }
    @GetMapping("/packing/excel")
    public ResponseEntity<byte[]> exportPackingExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        List<PackingReportRow> rows =
                packingService.getPackingReport(from, to);

        byte[] excel = exportService.exportPackingExcel(rows);

        return ResponseEntity.ok()
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=packing-report.xlsx"
                )
                .contentType(
                    MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                )
                .body(excel);
    }
    @GetMapping("/combined/excel")
    public ResponseEntity<byte[]> exportCombinedExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime from,

            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime to
    ) {
        var rows = combinedService.getCombinedReport(from, to);
        byte[] excel = exportService.exportCombinedExcel(rows);

        return ResponseEntity.ok()
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=packing-dispatch-report.xlsx"
                )
                .contentType(
                    MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                )
                .body(excel);
    }

}
