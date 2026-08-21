package com.alsorg.packing.bomflow.controller;

import com.alsorg.packing.bomflow.dto.BomFlowCommercialDtos.*;
import com.alsorg.packing.bomflow.service.BomFlowCommercialService;
import com.alsorg.packing.bomflow.service.BomFlowCommercialService.RateEvidenceDownload;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bomflow/commercial")
public class BomFlowCommercialController {

    private final BomFlowCommercialService service;

    public BomFlowCommercialController(
            BomFlowCommercialService service) {
        this.service = service;
    }

    /* ================= RATE MASTER ================= */

    @GetMapping("/rates")
    public List<MaterialRateResponse> materialRates(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean activeOnly) {
        return service.listMaterialRates(search, activeOnly);
    }

    @PostMapping("/rates")
    public MaterialRateResponse createMaterialRate(
            @RequestBody MaterialRateRequest request) {
        return service.createMaterialRate(request);
    }

    @PutMapping("/rates/{rateId}")
    public MaterialRateResponse updateMaterialRate(
            @PathVariable UUID rateId,
            @RequestBody MaterialRateRequest request) {
        return service.updateMaterialRate(rateId, request);
    }

    @PostMapping("/rates/{rateId}/active")
    public MaterialRateResponse setMaterialRateActive(
            @PathVariable UUID rateId,
            @RequestParam boolean active,
            @RequestParam Long rowVersion) {
        return service.setMaterialRateActive(rateId, active, rowVersion);
    }

    @PostMapping("/rates/apply/{revisionId}")
    public RateApplyResponse applyRates(
            @PathVariable UUID revisionId) {
        return service.applyRatesToRevision(revisionId);
    }

    @PostMapping(
            value = "/rates/{rateId}/evidence",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MaterialRateResponse uploadRateEvidence(
            @PathVariable UUID rateId,
            @RequestPart("file") MultipartFile file) {
        return service.uploadRateEvidence(rateId, file);
    }

    @GetMapping("/rates/{rateId}/evidence")
    public ResponseEntity<org.springframework.core.io.Resource> rateEvidence(
            @PathVariable UUID rateId) {
        RateEvidenceDownload download = service.downloadRateEvidence(rateId);
        MediaType mediaType;
        try {
            mediaType = download.contentType() == null || download.contentType().isBlank()
                    ? MediaType.APPLICATION_OCTET_STREAM
                    : MediaType.parseMediaType(download.contentType());
        } catch (IllegalArgumentException ex) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.originalFileName(), StandardCharsets.UTF_8)
                .build();
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString());
        if (download.fileSize() > 0) builder.contentLength(download.fileSize());
        return builder.body(download.resource());
    }

    @DeleteMapping("/rates/{rateId}/evidence")
    public MaterialRateResponse deleteRateEvidence(
            @PathVariable UUID rateId) {
        return service.deleteRateEvidence(rateId);
    }

    /* ================= LABOUR MASTER ================= */

    @GetMapping("/labour-rates")
    public List<LabourRateResponse> labourRates(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean activeOnly) {
        return service.listLabourRates(search, activeOnly);
    }

    @PostMapping("/labour-rates")
    public LabourRateResponse createLabourRate(
            @RequestBody LabourRateRequest request) {
        return service.createLabourRate(request);
    }

    @PutMapping("/labour-rates/{rateId}")
    public LabourRateResponse updateLabourRate(
            @PathVariable UUID rateId,
            @RequestBody LabourRateRequest request) {
        return service.updateLabourRate(rateId, request);
    }

    @PostMapping("/labour-rates/{rateId}/active")
    public LabourRateResponse setLabourRateActive(
            @PathVariable UUID rateId,
            @RequestParam boolean active,
            @RequestParam Long rowVersion) {
        return service.setLabourRateActive(rateId, active, rowVersion);
    }

    /* ================= COSTING ENGINE ================= */

    @GetMapping("/costing/{revisionId}")
    public CostingSummaryResponse costing(
            @PathVariable UUID revisionId) {
        return service.getCosting(revisionId);
    }

    @PutMapping("/costing/{revisionId}/settings")
    public CostingSettingsResponse saveCostingSettings(
            @PathVariable UUID revisionId,
            @RequestBody CostingSettingsRequest request) {
        return service.saveCostingSettings(revisionId, request);
    }

    @PostMapping("/costing/{revisionId}/labour-lines/sync")
    public LabourSyncResponse syncLabourMaster(
            @PathVariable UUID revisionId) {
        return service.syncLabourMaster(revisionId);
    }

    @PostMapping("/costing/{revisionId}/labour-lines")
    public LabourLineResponse addLabourLine(
            @PathVariable UUID revisionId,
            @RequestBody LabourLineRequest request) {
        return service.addLabourLine(revisionId, request);
    }

    @PutMapping("/costing/{revisionId}/labour-lines/{lineId}")
    public LabourLineResponse updateLabourLine(
            @PathVariable UUID revisionId,
            @PathVariable UUID lineId,
            @RequestBody LabourLineRequest request) {
        return service.updateLabourLine(revisionId, lineId, request);
    }

    @DeleteMapping("/costing/{revisionId}/labour-lines/{lineId}")
    public ResponseEntity<Void> deleteLabourLine(
            @PathVariable UUID revisionId,
            @PathVariable UUID lineId,
            @RequestParam Long rowVersion) {
        service.deleteLabourLine(revisionId, lineId, rowVersion);
        return ResponseEntity.noContent().build();
    }

    /* ================= DASHBOARD ================= */

    @GetMapping("/dashboard")
    public DashboardSummaryResponse dashboard() {
        return service.dashboard();
    }

    /* ================= REPORT EXPORTS ================= */

    @GetMapping("/reports/{revisionId}/materials.csv")
    public ResponseEntity<byte[]> materialsCsv(
            @PathVariable UUID revisionId) {
        return csv(service.materialCsv(revisionId), "BOMFlow_Direct_Material.csv");
    }

    @GetMapping("/reports/{revisionId}/labour.csv")
    public ResponseEntity<byte[]> labourCsv(
            @PathVariable UUID revisionId) {
        return csv(service.labourCsv(revisionId), "BOMFlow_Direct_Labour.csv");
    }

    @GetMapping("/reports/{revisionId}/costing.csv")
    public ResponseEntity<byte[]> costingCsv(
            @PathVariable UUID revisionId) {
        return csv(service.costingCsv(revisionId), "BOMFlow_Costing_Summary.csv");
    }

    @GetMapping("/reports/{revisionId}/change-log.csv")
    public ResponseEntity<byte[]> changeLogCsv(
            @PathVariable UUID revisionId) {
        return csv(service.changeLogCsv(revisionId), "BOMFlow_Change_Log.csv");
    }

    @GetMapping("/reports/{revisionId}/workbook.xlsx")
    public ResponseEntity<byte[]> workbookXlsx(
            @PathVariable UUID revisionId) {

        byte[] bytes = service.workbookXlsx(revisionId);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename("BOMFlow_Costing_Workbook.xlsx", StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentLength(bytes.length)
                .body(bytes);
    }

    private ResponseEntity<byte[]> csv(
            byte[] bytes,
            String fileName) {

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(fileName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentLength(bytes.length)
                .body(bytes);
    }
}
