package com.alsorg.packing.bomflow.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.UUID;

@Service
public class BomFlowProductFileStorageService {

    public enum FileSlot {
        PRODUCT_IMAGE("product-image"),
        DRAWING("drawing"),
        RATE_EVIDENCE("rate-evidence");

        private final String folder;

        FileSlot(String folder) {
            this.folder = folder;
        }

        public String folder() {
            return folder;
        }
    }

    public record StoredFile(
            String storedFileName,
            String storageKey,
            long fileSize) {
    }

    private final Path storageRoot;
    private final Path storageRootReal;

    public BomFlowProductFileStorageService(
            @Value("${bomflow.storage.root:./data/bomflow}") String storageRoot) {

        try {
            this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
            if (this.storageRoot.getParent() == null) {
                throw new IllegalStateException("Filesystem root cannot be used as BOMFlow storage.");
            }
            Files.createDirectories(this.storageRoot);
            this.storageRootReal = this.storageRoot.toRealPath();
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to initialize BOMFlow file storage.", ex);
        }
    }

    public StoredFile store(
            UUID productId,
            FileSlot slot,
            MultipartFile file,
            String safeExtension) {

        if (productId == null) throw badRequest("Product ID is required.");
        if (slot == null) throw badRequest("File slot is required.");
        if (file == null || file.isEmpty()) throw badRequest("File is required.");

        String extension = normalizeExtension(safeExtension);
        String storedFileName = UUID.randomUUID() + (extension.isEmpty() ? "" : "." + extension);

        Path directory = storageRoot
                .resolve(productId.toString())
                .resolve(slot.folder())
                .normalize();
        ensureLexicallyInsideRoot(directory);

        try {
            Files.createDirectories(directory);
            Path directoryReal = directory.toRealPath();
            if (!directoryReal.startsWith(storageRootReal)) {
                throw badRequest("Invalid BOMFlow storage path.");
            }

            Path target = directoryReal.resolve(storedFileName).normalize();
            if (!target.startsWith(storageRootReal)) {
                throw badRequest("Invalid BOMFlow storage path.");
            }

            try (var input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }

            if (Files.isSymbolicLink(target)) {
                Files.deleteIfExists(target);
                throw badRequest("Invalid BOMFlow storage target.");
            }

            long size = Files.size(target);
            String storageKey = storageRootReal
                    .relativize(target.toRealPath(LinkOption.NOFOLLOW_LINKS))
                    .toString()
                    .replace('\\', '/');

            return new StoredFile(storedFileName, storageKey, size);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to store BOMFlow file.",
                    ex);
        }
    }

    public Resource load(String storageKey) {
        Path path = resolveExisting(storageKey);
        return new PathResource(path);
    }

    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;

        Path path = resolveExistingOrMissing(storageKey);
        try {
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to delete BOMFlow file.",
                    ex);
        }
    }

    private Path resolveExisting(String storageKey) {
        Path path = resolveExistingOrMissing(storageKey);
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stored BOMFlow file was not found.");
        }
        try {
            Path real = path.toRealPath();
            if (!real.startsWith(storageRootReal)) {
                throw badRequest("Invalid BOMFlow storage path.");
            }
            return real;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Stored BOMFlow file was not found.");
        }
    }

    private Path resolveExistingOrMissing(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No BOMFlow file is stored.");
        }

        if (storageKey.indexOf('\0') >= 0) {
            throw badRequest("Invalid BOMFlow storage path.");
        }

        Path relative;
        try {
            relative = Path.of(storageKey.replace('\\', '/'));
        } catch (RuntimeException ex) {
            throw badRequest("Invalid BOMFlow storage path.");
        }

        if (relative.isAbsolute()) {
            throw badRequest("Invalid BOMFlow storage path.");
        }

        Path path = storageRootReal.resolve(relative).normalize();
        if (!path.startsWith(storageRootReal)) {
            throw badRequest("Invalid BOMFlow storage path.");
        }
        return path;
    }

    private void ensureLexicallyInsideRoot(Path path) {
        if (path == null || !path.normalize().startsWith(storageRoot)) {
            throw badRequest("Invalid BOMFlow storage path.");
        }
    }

    private String normalizeExtension(String value) {
        if (value == null || value.isBlank()) return "";
        String extension = value.trim().toLowerCase(Locale.ROOT);
        if (!extension.matches("[a-z0-9]{1,10}")) {
            throw badRequest("Invalid BOMFlow file extension.");
        }
        return extension;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
