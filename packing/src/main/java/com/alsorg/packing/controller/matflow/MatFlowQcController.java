package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowControlDtos.QcDispositionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcDecisionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcInspectionResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorReturnResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.service.matflow.MatFlowQcEvidenceService;
import com.alsorg.packing.service.matflow.MatFlowQcService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * AL-P1 Main Store QC checklist.
 *
 * QC is a check gate, not a Location. Normal workflow exposes only the check,
 * optional photo evidence, and rejected-lot actions.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowQcController {
    private final MatFlowQcService service;
    private final MatFlowQcEvidenceService evidence;

    public MatFlowQcController(MatFlowQcService service, MatFlowQcEvidenceService evidence) {
        this.service = service;
        this.evidence = evidence;
    }

    @GetMapping("/qc")
    public List<QcInspectionResponse> inspections(
            @RequestParam(required = false) QcInspectionStatus status) {
        return service.listInspections(status);
    }

    @PostMapping("/qc/{id}/decision")
    public QcInspectionResponse decide(
            @PathVariable UUID id,
            @RequestParam(required = false) Boolean qcDone,
            @Valid @RequestBody QcDecisionRequest request) {
        return service.decide(id, request, qcDone);
    }

    @PostMapping(value = "/qc/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public QcInspectionResponse uploadPhoto(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file) {
        evidence.save(id, file);
        return service.getInspection(id);
    }

    @GetMapping("/qc/{id}/photo")
    public ResponseEntity<Resource> photo(@PathVariable UUID id) {
        Resource resource = evidence.load(id);
        String fileName = safeFileName(evidence.fileName(id), "qc-evidence");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(evidence.contentType(id)))
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline()
                                .filename(fileName)
                                .build()
                                .toString())
                .body(resource);
    }

    @PostMapping("/qc/{id}/return-to-vendor")
    public VendorReturnResponse returnToVendor(
            @PathVariable UUID id,
            @Valid @RequestBody VendorReturnRequest request) {
        return service.returnToVendor(id, request);
    }

    @GetMapping("/qc-dispositions")
    public List<QcDispositionResponse> dispositions() {
        return service.listDispositions();
    }

    @PostMapping("/qc-dispositions/{inspectionId}")
    public QcDispositionResponse decideDisposition(
            @PathVariable UUID inspectionId,
            @Valid @RequestBody QcDispositionRequest request) {
        return service.decideDisposition(inspectionId, request);
    }

    private String safeFileName(
            String value,
            String fallback) {
        String clean = value == null ? "" : value.trim();
        clean = clean
                .replace("\r", "_")
                .replace("\n", "_")
                .replace("\"", "_")
                .replace("\\", "_")
                .replace("/", "_");

        if (clean.isBlank()) {
            clean = fallback;
        }

        return clean.length() > 180
                ? clean.substring(0, 180)
                : clean;
    }

}
