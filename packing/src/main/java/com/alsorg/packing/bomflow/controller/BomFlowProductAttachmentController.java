package com.alsorg.packing.bomflow.controller;

import com.alsorg.packing.bomflow.dto.BomFlowProductDtos.ProductResponse;
import com.alsorg.packing.bomflow.service.BomFlowProductAttachmentService;
import com.alsorg.packing.bomflow.service.BomFlowProductAttachmentService.ProductFileDownload;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@Validated
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/bomflow/products")
public class BomFlowProductAttachmentController {

    private final BomFlowProductAttachmentService service;

    public BomFlowProductAttachmentController(
            BomFlowProductAttachmentService service) {
        this.service = service;
    }

    @PostMapping(
            value = "/{productId}/image",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductResponse uploadImage(
            @PathVariable UUID productId,
            @RequestPart("file") MultipartFile file) {
        return service.uploadProductImage(productId, file);
    }

    @GetMapping("/{productId}/image")
    public ResponseEntity<org.springframework.core.io.Resource> image(
            @PathVariable UUID productId) {
        return fileResponse(service.downloadProductImage(productId), true);
    }

    @DeleteMapping("/{productId}/image")
    public ProductResponse deleteImage(
            @PathVariable UUID productId) {
        return service.deleteProductImage(productId);
    }

    @PostMapping(
            value = "/{productId}/drawing",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductResponse uploadDrawing(
            @PathVariable UUID productId,
            @RequestPart("file") MultipartFile file) {
        return service.uploadDrawing(productId, file);
    }

    @GetMapping("/{productId}/drawing")
    public ResponseEntity<org.springframework.core.io.Resource> drawing(
            @PathVariable UUID productId) {
        return fileResponse(service.downloadDrawing(productId), false);
    }

    @DeleteMapping("/{productId}/drawing")
    public ProductResponse deleteDrawing(
            @PathVariable UUID productId) {
        return service.deleteDrawing(productId);
    }

    private ResponseEntity<org.springframework.core.io.Resource> fileResponse(
            ProductFileDownload download,
            boolean inline) {

        MediaType mediaType = safeMediaType(download.contentType());
        String fileName = safeDownloadName(download.originalFileName(), inline ? "product-image" : "drawing");

        ContentDisposition disposition = (inline
                ? ContentDisposition.inline()
                : ContentDisposition.attachment())
                .filename(fileName, StandardCharsets.UTF_8)
                .build();

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString());

        if (download.fileSize() > 0) {
            builder.contentLength(download.fileSize());
        }

        return builder.body(download.resource());
    }

    private MediaType safeMediaType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }

        try {
            return MediaType.parseMediaType(contentType);
        } catch (IllegalArgumentException ex) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    private String safeDownloadName(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        String clean = value.replace('\\', '/');
        int slash = clean.lastIndexOf('/');
        if (slash >= 0) clean = clean.substring(slash + 1);
        clean = clean.replaceAll("[\\r\\n\\t]", "_").trim();
        if (clean.isBlank()) return fallback;
        return clean.length() > 500 ? clean.substring(clean.length() - 500) : clean;
    }
}
