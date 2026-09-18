package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.alsorg.packing.controller.dto.site.SiteLifecycleMetadataRow;
import com.alsorg.packing.controller.dto.site.SiteLifecycleResolveRequest;
import com.alsorg.packing.controller.dto.site.SiteLifecycleRow;
import com.alsorg.packing.domain.site.PacketSiteEvidence;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.SiteLifecycleService;

@RestController
@RequestMapping("/api/site-lifecycle")
public class SiteLifecycleController {

    private final SiteLifecycleService service;
    private final CurrentUserService currentUserService;

    public SiteLifecycleController(
            SiteLifecycleService service,
            CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @PostMapping(value = "/resolve", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SiteLifecycleRow> resolve(
            @RequestBody SiteLifecycleResolveRequest request) {
        User user = currentUserService.requireCurrentUser();
        SiteLifecycleRow row = service.resolve(
                request == null ? null : request.scanText(),
                request == null ? null : request.mode(),
                user);
        return noStore(ResponseEntity.ok(row));
    }

    @PostMapping(value = "/deliver", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SiteLifecycleRow> deliver(
            @RequestParam String scanText,
            @RequestParam Double latitude,
            @RequestParam Double longitude,
            @RequestParam Double accuracy,
            @RequestParam(required = false) String receiverName,
            @RequestParam(required = false) String receiverPhone,
            @RequestParam(required = false) String remarks,
            @RequestParam("photos") List<MultipartFile> photos) {
        User user = currentUserService.requireCurrentUser();
        SiteLifecycleRow row = service.deliver(
                scanText,
                latitude,
                longitude,
                accuracy,
                receiverName,
                receiverPhone,
                remarks,
                photos,
                user);
        return noStore(ResponseEntity.ok(row));
    }

    @PostMapping(value = "/open", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SiteLifecycleRow> openOnSite(
            @RequestParam String scanText,
            @RequestParam Double latitude,
            @RequestParam Double longitude,
            @RequestParam Double accuracy,
            @RequestParam(required = false) String remarks,
            @RequestParam(value = "photos", required = false) List<MultipartFile> photos) {
        User user = currentUserService.requireCurrentUser();
        SiteLifecycleRow row = service.openOnSite(
                scanText,
                latitude,
                longitude,
                accuracy,
                remarks,
                photos,
                user);
        return noStore(ResponseEntity.ok(row));
    }

    @PostMapping(value = "/metadata", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<SiteLifecycleMetadataRow>> metadata(
            @RequestBody List<UUID> packetItemIds) {
        User user = currentUserService.requireCurrentUser();
        return noStore(ResponseEntity.ok(service.metadata(packetItemIds, user)));
    }

    @GetMapping(value = "/metadata", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<SiteLifecycleMetadataRow>> metadataGet(
            @RequestParam(name = "ids") List<UUID> packetItemIds) {
        User user = currentUserService.requireCurrentUser();
        return noStore(ResponseEntity.ok(service.metadata(packetItemIds, user)));
    }

    @GetMapping(value = "/item", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SiteLifecycleRow> itemDetail(
            @RequestParam UUID packetItemId) {
        User user = currentUserService.requireCurrentUser();
        return noStore(ResponseEntity.ok(service.detail(packetItemId, user)));
    }

    @GetMapping(value = "/register", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<SiteLifecycleRow>> register(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String plant) {
        User user = currentUserService.requireCurrentUser();
        SiteLifecycleService.RegisterResult result = service.register(
                page,
                size,
                search,
                plant,
                user);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache")
                .header("X-Page-Number", String.valueOf(result.pageNumber()))
                .header("X-Page-Size", String.valueOf(result.pageSize()))
                .header("X-Total-Pages", String.valueOf(result.totalPages()))
                .header("X-Total-Elements", String.valueOf(result.totalElements()))
                .header("X-Has-Next", String.valueOf(result.hasNext()))
                .body(result.rows());
    }

    @GetMapping(value = "/evidence")
    public ResponseEntity<byte[]> evidence(@RequestParam UUID id) {
        User user = currentUserService.requireCurrentUser();
        PacketSiteEvidence evidence = service.requireEvidence(id, user);
        String contentType = evidence.getContentType() == null
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : evidence.getContentType();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache")
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"site-evidence-" + evidence.getId() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(evidence.getSizeBytes() == null
                        ? evidence.getFileData().length
                        : evidence.getSizeBytes())
                .body(evidence.getFileData());
    }

    private <T> ResponseEntity<T> noStore(ResponseEntity<T> response) {
        return ResponseEntity.status(response.getStatusCode())
                .headers(headers -> {
                    headers.putAll(response.getHeaders());
                    headers.setCacheControl(CacheControl.noStore());
                    headers.setPragma("no-cache");
                })
                .body(response.getBody());
    }
}
