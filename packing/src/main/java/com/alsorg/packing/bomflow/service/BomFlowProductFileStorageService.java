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
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class BomFlowProductFileStorageService {

    public enum FileSlot {
        PRODUCT_IMAGE("product-image"),
        DRAWING("drawing");

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

    public BomFlowProductFileStorageService(
            @Value("${bomflow.storage.root:./data/bomflow}")
            String storageRoot) {

        try {
            this.storageRoot = Path.of(storageRoot)
                    .toAbsolutePath()
                    .normalize();

            Files.createDirectories(this.storageRoot);
        } catch (IOException ex) {
            throw new IllegalStateException(
                    "Unable to initialize BOMFlow file storage.",
                    ex);
        }
    }

    public StoredFile store(
            UUID productId,
            FileSlot slot,
            MultipartFile file,
            String safeExtension) {

        if (productId == null) {
            throw badRequest("Product ID is required.");
        }

        if (slot == null) {
            throw badRequest("File slot is required.");
        }

        if (file == null || file.isEmpty()) {
            throw badRequest("File is required.");
        }

        String extension = safeExtension == null || safeExtension.isBlank()
                ? ""
                : "." + safeExtension.toLowerCase();

        String storedFileName = UUID.randomUUID() + extension;

        Path directory = storageRoot
                .resolve(productId.toString())
                .resolve(slot.folder())
                .normalize();

        ensureInsideRoot(directory);

        Path target = directory
                .resolve(storedFileName)
                .normalize();

        ensureInsideRoot(target);

        try {
            Files.createDirectories(directory);

            try (var input = file.getInputStream()) {
                Files.copy(
                        input,
                        target,
                        StandardCopyOption.REPLACE_EXISTING);
            }

            String storageKey = storageRoot
                    .relativize(target)
                    .toString()
                    .replace('\\', '/');

            return new StoredFile(
                    storedFileName,
                    storageKey,
                    Files.size(target));
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to store BOMFlow file.",
                    ex);
        }
    }

    public Resource load(
            String storageKey) {

        Path path = resolve(storageKey);

        if (!Files.isRegularFile(path)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Stored BOMFlow file was not found.");
        }

        return new PathResource(path);
    }

    public void delete(
            String storageKey) {

        if (storageKey == null || storageKey.isBlank()) {
            return;
        }

        Path path = resolve(storageKey);

        try {
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to delete BOMFlow file.",
                    ex);
        }
    }

    private Path resolve(
            String storageKey) {

        if (storageKey == null || storageKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No BOMFlow file is stored.");
        }

        Path path = storageRoot
                .resolve(storageKey)
                .normalize();

        ensureInsideRoot(path);

        return path;
    }

    private void ensureInsideRoot(
            Path path) {

        if (!path.startsWith(storageRoot)) {
            throw badRequest("Invalid BOMFlow storage path.");
        }
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }
}
