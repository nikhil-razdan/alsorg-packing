package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.domain.HrCandidateStage;
import com.alsorg.packing.hrflow.dto.HrAuditDtos;
import com.alsorg.packing.hrflow.dto.HrCandidateDtos;
import com.alsorg.packing.hrflow.security.HrAccessService;
import com.alsorg.packing.hrflow.service.HrAuditService;
import com.alsorg.packing.hrflow.service.HrCandidateService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/hrflow/candidates")
public class HrCandidateController {

    private final HrCandidateService candidateService;
    private final HrAuditService auditService;
    private final HrAccessService accessService;

    public HrCandidateController(HrCandidateService candidateService,
                                 HrAuditService auditService,
                                 HrAccessService accessService) {
        this.candidateService = candidateService;
        this.auditService = auditService;
        this.accessService = accessService;
    }

    @PostMapping
    public HrCandidateDtos.CandidateDetailResponse create(@Valid @RequestBody HrCandidateDtos.CreateCandidateRequest request) {
        return candidateService.create(request);
    }

    @GetMapping
    public Page<HrCandidateDtos.CandidateSummaryResponse> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) HrCandidateStage stage,
            Pageable pageable) {
        return candidateService.list(q, stage, pageable);
    }

    @GetMapping("/{id}")
    public HrCandidateDtos.CandidateDetailResponse get(@PathVariable UUID id) {
        return candidateService.get(id);
    }

    @PatchMapping("/{id}")
    public HrCandidateDtos.CandidateDetailResponse update(@PathVariable UUID id,
                                                           @Valid @RequestBody HrCandidateDtos.HrCandidateUpdateRequest request) {
        return candidateService.updateInternal(id, request);
    }

    @PostMapping("/{id}/application-link")
    public HrCandidateDtos.ApplicationLinkResponse applicationLink(@PathVariable UUID id) {
        return candidateService.createApplicationLink(id);
    }

    @PostMapping("/{id}/stage")
    public HrCandidateDtos.CandidateDetailResponse changeStage(@PathVariable UUID id,
                                                                @Valid @RequestBody HrCandidateDtos.ChangeStageRequest request) {
        return candidateService.changeStage(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCandidate(
            @PathVariable UUID id,
            @RequestParam Long rowVersion) {
        candidateService.deleteCandidate(id, rowVersion);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/reference/form-template/{formKey}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> formTemplate(@PathVariable String formKey) {
        return pdf(candidateService.formTemplate(formKey));
    }

    @GetMapping(value = "/{id}/form-pdf/{formKey}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> candidateFormPdf(
            @PathVariable UUID id,
            @PathVariable String formKey) {
        return pdf(candidateService.candidateFormPdf(id, formKey));
    }

    @GetMapping("/{id}/audit")
    public List<HrAuditDtos.AuditResponse> audit(@PathVariable UUID id) {
        accessService.requireAny(HrAccessRole.HR_ADMIN, HrAccessRole.HR_HEAD, HrAccessRole.HR_EXECUTIVE, HrAccessRole.RECRUITER, HrAccessRole.HOD);
        return auditService.recentFor("CANDIDATE", id.toString()).stream()
                .map(x -> new HrAuditDtos.AuditResponse(x.getId(), x.getAction(), x.getEntityType(), x.getEntityId(),
                        x.getActor(), x.getMessage(), x.getMetadataJson(), x.getCreatedAt()))
                .toList();
    }
    private ResponseEntity<byte[]> pdf(HrCandidateService.FormPdf pdf) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + pdf.fileName().replace("\"", "") + "\"")
                .body(pdf.bytes());
    }

}
