package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.VenFlowAttachmentDtos.AttachmentResponse;
import com.alsorg.packing.controller.dto.VenFlowAttachmentDtos.DeactivateAttachmentRequest;
import com.alsorg.packing.domain.venflow.VenFlowAttachment;
import com.alsorg.packing.domain.venflow.VenFlowAttachmentType;
import com.alsorg.packing.service.VenFlowAttachmentService;
import com.alsorg.packing.service.VenFlowAttachmentService.AttachmentDownload;

import org.springframework.core.io.Resource;
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
@RequestMapping("/api/venflow")
public class VenFlowAttachmentController {

    private final VenFlowAttachmentService service;

    public VenFlowAttachmentController(
            VenFlowAttachmentService service) {

        this.service = service;
    }

    @PostMapping(
            value = "/entries/{entryId}/attachments",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttachmentResponse upload(
            @PathVariable UUID entryId,

            @RequestParam
            VenFlowAttachmentType type,

            @RequestPart("file")
            MultipartFile file) {

        return service.upload(
                entryId,
                type,
                file);
    }

    @GetMapping(
            "/entries/{entryId}/attachments")
    public List<AttachmentResponse> list(
            @PathVariable UUID entryId,

            @RequestParam(required = false)
            VenFlowAttachmentType type) {

        return service.list(
                entryId,
                type);
    }

    @GetMapping(
            "/entries/{entryId}/attachments/"
                    + "{attachmentId}/download")
    public ResponseEntity<Resource> download(
            @PathVariable UUID entryId,
            @PathVariable UUID attachmentId) {

        AttachmentDownload download =
                service.download(
                        entryId,
                        attachmentId);

        VenFlowAttachment attachment =
                download.attachment();

        MediaType mediaType =
                safeMediaType(
                        attachment.contentType);

        ContentDisposition disposition =
                ContentDisposition
                        .attachment()
                        .filename(
                                attachment.originalFileName,
                                StandardCharsets.UTF_8)
                        .build();

        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(
                        attachment.fileSize)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString())
                .body(
                        download.resource());
    }

    @PatchMapping(
            "/entries/{entryId}/attachments/"
                    + "{attachmentId}/deactivate")
    public AttachmentResponse deactivate(
            @PathVariable UUID entryId,
            @PathVariable UUID attachmentId,
            @RequestBody
            DeactivateAttachmentRequest req) {

        return service.deactivate(
                entryId,
                attachmentId,
                req);
    }

    private MediaType safeMediaType(
            String contentType) {

        if (contentType == null
                || contentType.isBlank()) {

            return MediaType
                    .APPLICATION_OCTET_STREAM;
        }

        try {
            return MediaType.parseMediaType(
                    contentType);

        } catch (IllegalArgumentException ex) {
            return MediaType
                    .APPLICATION_OCTET_STREAM;
        }
    }
}