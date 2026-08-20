package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrDocumentType;
import com.alsorg.packing.hrflow.dto.HrDocumentDtos;
import com.alsorg.packing.hrflow.service.HrDocumentService;
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
@RequestMapping("/api/hrflow/candidates/{candidateId}/documents")
public class HrCandidateDocumentController {

    private final HrDocumentService documentService;

    public HrCandidateDocumentController(HrDocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping
    public List<HrDocumentDtos.DocumentResponse> list(
            @PathVariable UUID candidateId,
            @RequestParam(defaultValue = "false") boolean includeArchived
    ) {
        return documentService.listInternal(candidateId, includeArchived);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public HrDocumentDtos.DocumentResponse upload(
            @PathVariable UUID candidateId,
            @RequestParam HrDocumentType documentType,
            @RequestParam(required = false) String remarks,
            @RequestPart("file") MultipartFile file
    ) {
        return documentService.uploadInternal(candidateId, documentType, remarks, file);
    }

    @GetMapping("/{documentId}/download")
    public ResponseEntity<byte[]> download(
            @PathVariable UUID candidateId,
            @PathVariable UUID documentId
    ) {
        HrDocumentService.DownloadedDocument document =
                documentService.downloadInternal(candidateId, documentId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(safeMediaType(document.contentType()));
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename(document.fileName(), StandardCharsets.UTF_8)
                        .build()
        );

        return ResponseEntity.ok()
                .headers(headers)
                .body(document.bytes());
    }

    @DeleteMapping("/{documentId}")
    public HrDocumentDtos.DocumentResponse archive(
            @PathVariable UUID candidateId,
            @PathVariable UUID documentId
    ) {
        return documentService.archiveInternal(candidateId, documentId);
    }

    @GetMapping("/completeness")
    public HrDocumentDtos.DocumentCompletenessResponse completeness(
            @PathVariable UUID candidateId
    ) {
        return documentService.completeness(candidateId);
    }

    private MediaType safeMediaType(String value) {
        try {
            return MediaType.parseMediaType(value);
        } catch (Exception ignored) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
