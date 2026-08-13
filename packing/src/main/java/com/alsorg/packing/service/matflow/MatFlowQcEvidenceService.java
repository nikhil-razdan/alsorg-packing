package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowQcInspection;
import com.alsorg.packing.repository.matflow.MatFlowQcInspectionRepository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Optional image evidence for the simple MatFlow QC check.
 *
 * QC evidence deliberately does not create another business document or table.
 * The durable QC row remains the audit record; at most one active image is stored
 * per QC UUID on the configured filesystem. Uploading a replacement image
 * atomically replaces the previous file.
 */
@Service
public class MatFlowQcEvidenceService {

    private static final long MAX_BYTES = 8L * 1024L * 1024L;
    private static final Set<String> EXTENSIONS = Set.of("png", "jpg", "jpeg", "webp");
    private static final List<String> ORDERED_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");

    private final MatFlowQcInspectionRepository qcRepository;
    private final MatFlowAccessService accessService;
    private final Path root;

    public MatFlowQcEvidenceService(
            MatFlowQcInspectionRepository qcRepository,
            MatFlowAccessService accessService,
            @Value("${matflow.qc-evidence-dir:}") String configuredDirectory) {
        this.qcRepository = qcRepository;
        this.accessService = accessService;
        this.root = resolveRoot(configuredDirectory);
        try {
            Files.createDirectories(root);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to initialize MatFlow QC evidence directory: " + root, ex);
        }
    }

    public void save(UUID qcId, MultipartFile file) {
        accessService.requireQcWrite();
        MatFlowQcInspection check = requireVisible(qcId);
        validate(file);

        String extension = extension(file.getOriginalFilename());
        Path target = root.resolve(qcId + "." + extension).normalize();
        if (!target.getParent().equals(root)) {
            throw badRequest("Invalid QC evidence file path");
        }

        Path temporary = root.resolve(qcId + ".upload-" + UUID.randomUUID() + ".tmp");
        try {
            Files.copy(file.getInputStream(), temporary, StandardCopyOption.REPLACE_EXISTING);
            for (String ext : ORDERED_EXTENSIONS) {
                Path old = root.resolve(qcId + "." + ext);
                if (!old.equals(target)) {
                    Files.deleteIfExists(old);
                }
            }
            try {
                Files.move(temporary, target,
                        StandardCopyOption.ATOMIC_MOVE,
                        StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
                Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            try {
                Files.deleteIfExists(temporary);
            } catch (IOException ignored) {
                // best-effort cleanup
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to store QC picture", ex);
        }
    }

    public boolean exists(UUID qcId) {
        return findPath(qcId) != null;
    }

    public Resource load(UUID qcId) {
        accessService.requireRead();
        requireVisible(qcId);
        Path path = findPath(qcId);
        if (path == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "QC picture not found");
        }
        return new FileSystemResource(path);
    }

    public String contentType(UUID qcId) {
        Path path = findPath(qcId);
        if (path == null) {
            return "application/octet-stream";
        }
        try {
            String type = Files.probeContentType(path);
            return type == null ? mediaTypeForExtension(extension(path.getFileName().toString())) : type;
        } catch (IOException ignored) {
            return mediaTypeForExtension(extension(path.getFileName().toString()));
        }
    }

    public String fileName(UUID qcId) {
        Path path = findPath(qcId);
        return path == null ? "qc-picture" : path.getFileName().toString();
    }

    private MatFlowQcInspection requireVisible(UUID qcId) {
        if (qcId == null) {
            throw badRequest("QC record ID is required");
        }
        MatFlowQcInspection check = qcRepository.findById(qcId)
                .map(value -> (MatFlowQcInspection) Hibernate.unproxy(value))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "QC check not found"));
        if (check.location == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "QC check has no internal plant context");
        }
        accessService.requirePlantAccess(check.location.getPlantCode());
        return check;
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw badRequest("Select a QC picture to upload");
        }
        if (file.getSize() > MAX_BYTES) {
            throw badRequest("QC picture cannot exceed 8 MB");
        }
        String ext = extension(file.getOriginalFilename());
        if (!EXTENSIONS.contains(ext)) {
            throw badRequest("QC picture must be PNG, JPG/JPEG or WEBP");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw badRequest("QC evidence must be an image");
        }
    }

    private Path findPath(UUID qcId) {
        if (qcId == null) {
            return null;
        }
        for (String ext : ORDERED_EXTENSIONS) {
            Path candidate = root.resolve(qcId + "." + ext);
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private Path resolveRoot(String configured) {
        if (configured != null && !configured.trim().isBlank()) {
            return Path.of(configured.trim()).toAbsolutePath().normalize();
        }
        return Path.of(
                System.getProperty("user.home"),
                ".flowsuite",
                "matflow",
                "qc-evidence").toAbsolutePath().normalize();
    }

    private String extension(String fileName) {
        if (fileName == null) {
            return "";
        }
        String name = fileName.trim();
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String mediaTypeForExtension(String ext) {
        return switch (ext) {
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "jpg", "jpeg" -> "image/jpeg";
            default -> "application/octet-stream";
        };
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
