package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcDecisionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.QcInspectionResponse;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.service.matflow.MatFlowQcEvidenceService;
import com.alsorg.packing.service.matflow.MatFlowQcService;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

import org.springframework.core.io.Resource;
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
 * Simple MR-linked QC check boundary.
 *
 * There is deliberately no QC location endpoint and no QC routing endpoint.
 * Store owns the Processing/Production route. QC only completes the requested
 * check and may attach one optional picture as evidence.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowQcController {

    private final MatFlowQcService service;
    private final MatFlowQcEvidenceService evidenceService;

    public MatFlowQcController(
            MatFlowQcService service,
            MatFlowQcEvidenceService evidenceService) {
        this.service = service;
        this.evidenceService = evidenceService;
    }

    @GetMapping("/qc")
    public List<QcInspectionResponse> list(
            @RequestParam(required = false) QcInspectionStatus status) {
        return service.listInspections(status);
    }

    /** Tick / complete the QC check. */
    @PostMapping("/qc/{id}/decision")
    public QcInspectionResponse complete(
            @PathVariable UUID id,
            @Valid @RequestBody QcDecisionRequest request) {
        return service.decide(id, request);
    }

    /** Optional picture evidence; uploading again replaces the existing picture. */
    @PostMapping(value = "/qc/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public QcInspectionResponse uploadPhoto(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file) {
        evidenceService.save(id, file);
        return service.getInspection(id);
    }

    @GetMapping("/qc/{id}/photo")
    public ResponseEntity<Resource> photo(@PathVariable UUID id) {
        Resource resource = evidenceService.load(id);
        String type = evidenceService.contentType(id);
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(type);
        } catch (IllegalArgumentException ignored) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + evidenceService.fileName(id).replace("\"", "") + "\"")
                .body(resource);
    }
}
    