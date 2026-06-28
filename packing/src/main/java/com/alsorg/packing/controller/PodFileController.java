package com.alsorg.packing.controller;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.alsorg.packing.domain.files.PodFile;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.PodFileRepository;
import com.alsorg.packing.service.CurrentUserService;

@RestController
@RequestMapping("/api/pod-files")
public class PodFileController {

    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024L * 1024L;

    @Autowired
    private PodFileRepository podFileRepository;

    @Autowired
    private CurrentUserService currentUserService;

    @PostMapping(
        value = "/upload",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public Map<String, Object> uploadPodFile(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam("file") MultipartFile file
    ) throws IOException {

        User user = currentUserService.getCurrentUserFromAuth(auth);

        if (
            user == null ||
            !(
                currentUserService.isAdmin(user) ||
                currentUserService.isDispatch(user) ||
                currentUserService.isLogistics(user)
            )
        ) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Access denied"
            );
        }

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "POD photo is required"
            );
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "POD photo must be under 5 MB"
            );
        }

        String contentType = file.getContentType();

        if (
            contentType == null ||
            !contentType.toLowerCase().startsWith("image/")
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Only image files are allowed"
            );
        }

        String originalName = file.getOriginalFilename();
        String safeName = sanitizeFilename(originalName);

        PodFile podFile = new PodFile();
        podFile.setFilename(safeName);
        podFile.setContentType(contentType);
        podFile.setSizeBytes(file.getSize());
        podFile.setData(file.getBytes());
        podFile.setCreatedBy(
            user.getUsername() == null
                ? "system"
                : user.getUsername()
        );

        podFile = podFileRepository.save(podFile);

        String url = ServletUriComponentsBuilder
            .fromCurrentContextPath()
            .path("/api/pod-files/")
            .path(podFile.getId().toString())
            .toUriString();

        return Map.of(
            "id", podFile.getId().toString(),
            "url", url,
            "filename", podFile.getFilename(),
            "contentType", podFile.getContentType(),
            "sizeBytes", podFile.getSizeBytes()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getPodFile(
            @PathVariable UUID id
    ) {
        PodFile podFile = podFileRepository
            .findById(id)
            .orElseThrow(() ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "POD photo not found"
                )
            );

        MediaType mediaType = MediaType.IMAGE_JPEG;

        try {
            if (podFile.getContentType() != null) {
                mediaType = MediaType.parseMediaType(
                    podFile.getContentType()
                );
            }
        } catch (Exception ignored) {
            mediaType = MediaType.IMAGE_JPEG;
        }

        return ResponseEntity
            .ok()
            .contentType(mediaType)
            .cacheControl(
                CacheControl
                    .maxAge(365, TimeUnit.DAYS)
                    .cachePublic()
            )
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition
                    .inline()
                    .filename(
                        podFile.getFilename() == null
                            ? "pod-photo.jpg"
                            : podFile.getFilename()
                    )
                    .build()
                    .toString()
            )
            .body(podFile.getData());
    }

    private String sanitizeFilename(String name) {
        if (name == null || name.isBlank()) {
            return "pod-photo.jpg";
        }

        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}