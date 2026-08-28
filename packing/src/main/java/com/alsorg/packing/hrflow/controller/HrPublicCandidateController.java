package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.dto.HrCandidateDtos;
import com.alsorg.packing.hrflow.service.HrCandidateService;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

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
        byte[] bytes = pdf.bytes() == null ? new byte[0] : pdf.bytes();
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(safeFileName(pdf.fileName()), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(bytes);
    }

    private String safeFileName(String value) {
        if (value == null || value.isBlank()) {
            return "hrflow-candidate-form.pdf";
        }
        String clean = value.replaceAll("[\\r\\n\\t]", "_").trim();
        return clean.isBlank() ? "hrflow-candidate-form.pdf" : clean;
    }

}
