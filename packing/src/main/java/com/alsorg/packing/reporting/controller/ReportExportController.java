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
import com.alsorg.packing.reporting.service.InventoryReportWorkbookService;
import com.alsorg.packing.reporting.service.PackingReportService;
import com.alsorg.packing.reporting.service.ReportExportService;

@RestController
@RequestMapping("/api/reports/export")
public class ReportExportController {

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
                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
                List<DispatchReportRow> rows = dispatchService.getDispatchReport(from, to);

                byte[] csv = exportService.exportDispatchCsv(rows);

                return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=dispatch-report.csv")
                                .contentType(MediaType.TEXT_PLAIN)
                                .body(csv);
        }

        @GetMapping("/dispatch/excel")
        public ResponseEntity<byte[]> exportDispatchExcel(
                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
                byte[] excel = workbookService.exportInventoryReport(
                                "dispatch",
                                from,
                                to);

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=\"Dispatch Register.xlsx\"")
                                .contentType(
                                                MediaType.parseMediaType(
                                                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                                .body(excel);
        }

        @GetMapping("/packing/csv")
        public ResponseEntity<byte[]> exportPackingCsv(
                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
                List<PackingReportRow> rows = packingService.getPackingReport(from, to);

                byte[] csv = exportService.exportPackingCsv(rows);

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=packing-report.csv")
                                .contentType(MediaType.TEXT_PLAIN)
                                .body(csv);
        }

        @GetMapping("/packing/excel")
        public ResponseEntity<byte[]> exportPackingExcel(
                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
                byte[] excel = workbookService.exportInventoryReport(
                                "packing",
                                from,
                                to);

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=packing-professional-report.xlsx")
                                .contentType(
                                                MediaType.parseMediaType(
                                                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                                .body(excel);
        }

        @GetMapping("/combined/excel")
        public ResponseEntity<byte[]> exportCombinedExcel(
                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
                byte[] excel = workbookService.exportInventoryReport(
                                "inventory",
                                from,
                                to);

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=\"Inventory Director BI Report.xlsx\"")
                                .contentType(
                                                MediaType.parseMediaType(
                                                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                                .body(excel);
        }

        @GetMapping("/inventory/excel")
        public ResponseEntity<byte[]> exportInventoryExcel(
                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

                        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
                byte[] excel = workbookService.exportInventoryReport(
                                "inventory",
                                from,
                                to);

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=\"Inventory Director BI Report.xlsx\"")
                                .contentType(
                                                MediaType.parseMediaType(
                                                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                                .body(excel);
        }

}
