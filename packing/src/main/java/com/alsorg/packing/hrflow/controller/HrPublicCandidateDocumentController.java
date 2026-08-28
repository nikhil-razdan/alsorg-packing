package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrCandidate;
import com.alsorg.packing.hrflow.domain.HrDocumentType;
import com.alsorg.packing.hrflow.dto.HrDocumentDtos;
import com.alsorg.packing.hrflow.service.HrCandidateTokenService;
import com.alsorg.packing.hrflow.service.HrDocumentService;
import org.springframework.http.CacheControl;
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
@RequestMapping("/api/hrflow/public/applications/{token}/documents")
public class HrPublicCandidateDocumentController {

    private final HrCandidateTokenService tokenService;
    private final HrDocumentService documentService;

    public HrPublicCandidateDocumentController(
            HrCandidateTokenService tokenService,
            HrDocumentService documentService
    ) {
        this.tokenService = tokenService;
        this.documentService = documentService;
    }

    @GetMapping
    public List<HrDocumentDtos.DocumentResponse> list(@PathVariable String token) {
        HrCandidate candidate = tokenService.resolvePublicCandidateToken(token);
        return documentService.listPublic(candidate);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public HrDocumentDtos.DocumentResponse upload(
            @PathVariable String token,
            @RequestParam HrDocumentType documentType,
            @RequestParam(required = false) String remarks,
            @RequestPart("file") MultipartFile file
    ) {
        HrCandidate candidate = tokenService.resolvePublicCandidateToken(token);
        return documentService.uploadPublic(candidate, documentType, remarks, file);
    }

    @GetMapping("/{documentId}/download")
    public ResponseEntity<byte[]> download(
            @PathVariable String token,
            @PathVariable UUID documentId
    ) {
        HrCandidate candidate = tokenService.resolvePublicCandidateToken(token);
        HrDocumentService.DownloadedDocument document = documentService.downloadPublic(candidate, documentId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(safeMediaType(document.contentType()));
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename(document.fileName(), StandardCharsets.UTF_8)
                        .build()
        );

        byte[] bytes = document.bytes() == null ? new byte[0] : document.bytes();

        return ResponseEntity.ok()
                .headers(headers)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .contentLength(bytes.length)
                .body(bytes);
    }

    private MediaType safeMediaType(String value) {
        try {
            return MediaType.parseMediaType(value);
        } catch (Exception ignored) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
