package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.dto.HrCandidateDtos;
import com.alsorg.packing.hrflow.service.HrCandidateService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hrflow/public/applications")
public class HrPublicCandidateController {

    private final HrCandidateService service;

    public HrPublicCandidateController(HrCandidateService service) {
        this.service = service;
    }

    @GetMapping("/{token}")
    public HrCandidateDtos.PublicCandidateApplicationResponse get(@PathVariable String token) {
        return service.getPublicApplication(token);
    }

    @PutMapping("/{token}")
    public HrCandidateDtos.PublicCandidateApplicationResponse saveDraft(
            @PathVariable String token,
            @Valid @RequestBody HrCandidateDtos.CandidateApplicationRequest request) {
        return service.savePublicDraft(token, request);
    }

    @PostMapping("/{token}/submit")
    public HrCandidateDtos.PublicCandidateApplicationResponse submit(
            @PathVariable String token,
            @Valid @RequestBody HrCandidateDtos.CandidateApplicationRequest request) {
        return service.submitPublicApplication(token, request);
    }
    @GetMapping(value = "/{token}/form-pdf/{formKey}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> formPdf(
            @PathVariable String token,
            @PathVariable String formKey) {
        HrCandidateService.FormPdf pdf = service.publicCandidateFormPdf(token, formKey);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + pdf.fileName().replace("\"", "") + "\"")
                .body(pdf.bytes());
    }

}
