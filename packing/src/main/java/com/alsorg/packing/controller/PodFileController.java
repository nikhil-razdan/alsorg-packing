package com.alsorg.packing.controller;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    private static final int MAX_FILENAME_LENGTH = 180;

    private final PodFileRepository podFileRepository;
    private final CurrentUserService currentUserService;

    public PodFileController(
            PodFileRepository podFileRepository,
            CurrentUserService currentUserService) {
        this.podFileRepository = podFileRepository;
        this.currentUserService = currentUserService;
    }

    @PostMapping(
            value = "/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadPodFile(
            @RequestParam("file") MultipartFile file) throws IOException {

        User user = currentUserService.requireCurrentUser();
        requireUploadAccess(user);

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "POD photo is required");
        }

        if (file.getSize() <= 0L || file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "POD photo must be under 5 MB");
        }

        byte[] data = file.getBytes();
        String verifiedType = detectImageType(data);

        if (verifiedType == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Only JPEG, PNG or WebP image files are allowed");
        }

        String safeName = sanitizeFilename(
                file.getOriginalFilename(),
                verifiedType);

        PodFile podFile = new PodFile();
        podFile.setFilename(safeName);
        podFile.setContentType(verifiedType);
        podFile.setSizeBytes((long) data.length);
        podFile.setData(data);
        podFile.setCreatedBy(user.getUsername());

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
                "sizeBytes", podFile.getSizeBytes());
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getPodFile(
            @PathVariable UUID id) {

        User user = currentUserService.requireCurrentUser();
        requireReadAccess(user);

        PodFile podFile = podFileRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "POD photo not found"));

        byte[] data = podFile.getData();

        if (data == null || data.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "POD photo data is missing");
        }

        String verifiedType = detectImageType(data);

        if (verifiedType == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Stored POD file is not a supported image");
        }

        String filename = sanitizeFilename(
                podFile.getFilename(),
                verifiedType);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(verifiedType))
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline()
                                .filename(filename)
                                .build()
                                .toString())
                .body(data);
    }

    private void requireUploadAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Access denied");
        }
    }

    private void requireReadAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS", "DRIVER")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Access denied");
        }
    }

    private String detectImageType(byte[] data) {
        if (data == null || data.length < 12) {
            return null;
        }

        if ((data[0] & 0xFF) == 0xFF
                && (data[1] & 0xFF) == 0xD8
                && (data[2] & 0xFF) == 0xFF) {
            return MediaType.IMAGE_JPEG_VALUE;
        }

        if ((data[0] & 0xFF) == 0x89
                && data[1] == 0x50
                && data[2] == 0x4E
                && data[3] == 0x47
                && data[4] == 0x0D
                && data[5] == 0x0A
                && data[6] == 0x1A
                && data[7] == 0x0A) {
            return MediaType.IMAGE_PNG_VALUE;
        }

        if (data[0] == 'R'
                && data[1] == 'I'
                && data[2] == 'F'
                && data[3] == 'F'
                && data[8] == 'W'
                && data[9] == 'E'
                && data[10] == 'B'
                && data[11] == 'P') {
            return "image/webp";
        }

        return null;
    }

    private String sanitizeFilename(
            String name,
            String contentType) {

        String fallback = switch (contentType) {
            case MediaType.IMAGE_PNG_VALUE -> "pod-photo.png";
            case "image/webp" -> "pod-photo.webp";
            default -> "pod-photo.jpg";
        };

        if (name == null || name.isBlank()) {
            return fallback;
        }

        String cleaned = name
                .replace('\\', '_')
                .replace('/', '_')
                .replaceAll("[^a-zA-Z0-9._-]", "_")
                .replaceAll("_+", "_");

        if (cleaned.isBlank() || ".".equals(cleaned) || "..".equals(cleaned)) {
            return fallback;
        }

        if (cleaned.length() > MAX_FILENAME_LENGTH) {
            cleaned = cleaned.substring(0, MAX_FILENAME_LENGTH);
        }

        return cleaned;
    }
}
